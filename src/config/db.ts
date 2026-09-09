import mongoose from "mongoose";
import { env } from "./env";

/**
 * Resolves a mongodb+srv:// URI to a standard replica-set URI using DNS-over-HTTPS (DoH).
 * Bypasses local ISP / router DNS timeouts on queryTxt (ETIMEOUT).
 */
interface DnsResponse {
  Status: number;
  Answer?: Array<{ name: string; type: number; TTL: number; data: string }>;
}

async function resolveSrvUri(uri: string): Promise<string> {
  const match = uri.match(/^mongodb\+srv:\/\/([^@]+)@([^/?]+)(?:\/([^?]*))?(?:\?(.*))?$/);
  if (!match) return uri;

  const [, creds, host, db, query] = match;

  const fetchDns = async (name: string, type: string): Promise<DnsResponse> => {
    try {
      const res = await fetch(`https://dns.google/resolve?name=${name}&type=${type}`);
      return (await res.json()) as DnsResponse;
    } catch {
      const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${name}&type=${type}`, {
        headers: { accept: "application/dns-json" },
      });
      return (await res.json()) as DnsResponse;
    }
  };

  const [srvRes, txtRes] = await Promise.all([
    fetchDns(`_mongodb._tcp.${host}`, "SRV"),
    fetchDns(host, "TXT"),
  ]);

  if (!srvRes.Answer || srvRes.Answer.length === 0) {
    throw new Error(`Unable to resolve SRV records for ${host}`);
  }

  const hosts = srvRes.Answer.map((a) => {
    const parts = a.data.split(" ");
    const port = parts[2];
    const hostname = parts[3].replace(/\.$/, "");
    return `${hostname}:${port}`;
  });

  const txtOpts = txtRes.Answer
    ? txtRes.Answer.map((a) => a.data.replace(/"/g, "")).join("&")
    : "";

  const allParams = ["ssl=true", txtOpts, query].filter(Boolean).join("&");
  return `mongodb://${creds}@${hosts.join(",")}${db ? "/" + db : "/"}${allParams ? "?" + allParams : ""}`;
}

export const connectDB = async (): Promise<typeof mongoose> => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error: any) {
    // Check if error is due to local DNS failing TXT/SRV resolution (queryTxt ETIMEOUT)
    if (
      env.MONGODB_URI.startsWith("mongodb+srv://") &&
      (error?.code === "ETIMEOUT" ||
        error?.syscall === "queryTxt" ||
        String(error?.message).includes("queryTxt ETIMEOUT"))
    ) {
      try {
        console.warn("⚠️  Local network DNS timed out resolving MongoDB SRV/TXT records.");
        console.log("📡 Attempting automatic resolution via DNS-over-HTTPS (DoH)...");
        const fallbackUri = await resolveSrvUri(env.MONGODB_URI);
        const conn = await mongoose.connect(fallbackUri);
        console.log(`✅ MongoDB Connected via Fallback ReplicaSet: ${conn.connection.host}`);
        return conn;
      } catch (fallbackError) {
        console.error("❌ Fallback MongoDB connection failed:", fallbackError);
      }
    }

    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
};