import { User, IUser, SerializedUser } from "../models/User";
import { RefreshToken } from "../models/RefreshToken";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import { createApiError } from "../utils/ApiError";
import { SignupInput, LoginInput, AuthTokens } from "../types/authTypes";
import { sendVerificationEmail } from "./emailService";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * Generate access and refresh tokens for a user
 * Stores refresh token in database for later verification
 *
 * @param user - User document from MongoDB
 * @returns Access and refresh tokens
 */
async function generateTokens(user: IUser): Promise<AuthTokens> {
  const payload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Store refresh token in database for verification and revocation
  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  return { accessToken, refreshToken };
}

/**
 * Register a new user account (sends verification email)
 *
 * @param input - User signup data (name, email, password, avatar)
 * @returns Success message indicating email was sent
 * @throws ApiError 409 if email already exists and is verified
 */
export async function userSignup(
  input: SignupInput & { avatar?: string },
): Promise<{ success: boolean; message: string }> {
  const { email, name, password, avatar } = input;
  
  const existingUser = await User.findOne({ email });
  
  if (existingUser) {
    if (existingUser.isVerified) {
      throw createApiError(409, "An account with this email already exists");
    }
    // Unverified existing user -> update their details instead of throwing error
    existingUser.name = name;
    existingUser.password = password;
    if (avatar) existingUser.avatar = avatar;
    
    const code = crypto.randomInt(100000, 999999).toString();
    const hashedCode = await bcrypt.hash(code, 12);
    
    existingUser.verificationCode = hashedCode;
    existingUser.verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await existingUser.save();
    
    try {
      await sendVerificationEmail(email, code);
    } catch (error) {
      throw createApiError(500, "Failed to send verification email. Please check your SMTP configuration. If using Gmail, you MUST use an App Password, not your normal password.");
    }
    return { success: true, message: "Verification code sent" };
  }

  // Create new unverified user
  const code = crypto.randomInt(100000, 999999).toString();
  const hashedCode = await bcrypt.hash(code, 12);

  await User.create({
    name,
    email,
    password,
    avatar,
    isVerified: false,
    verificationCode: hashedCode,
    verificationCodeExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
  });

  try {
    await sendVerificationEmail(email, code);
  } catch (error) {
    throw createApiError(500, "Failed to send verification email. Please check your SMTP configuration. If using Gmail, you MUST use an App Password, not your normal password.");
  }

  return { success: true, message: "Verification code sent" };
}

/**
 * Verifies a student's email using the 6-digit code.
 *
 * @param email - Student email
 * @param code - 6-digit verification code
 * @returns User data and tokens
 */
export async function verifyEmail(
  email: string,
  code: string
): Promise<{ user: Partial<IUser>; tokens: AuthTokens }> {
  const user = await User.findOne({ email }).select("+verificationCode +verificationCodeExpiresAt");
  
  if (!user) throw createApiError(404, "User not found");
  if (user.isVerified) throw createApiError(400, "Email is already verified");
  if (!user.verificationCode || !user.verificationCodeExpiresAt) {
    throw createApiError(400, "No verification pending for this user");
  }
  if (user.verificationCodeExpiresAt < new Date()) {
    throw createApiError(400, "Verification code has expired. Please request a new one.");
  }

  const isValid = await bcrypt.compare(code, user.verificationCode);
  if (!isValid) throw createApiError(400, "Invalid verification code");

  // Mark as verified and clean up code fields
  user.isVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpiresAt = undefined;
  await user.save();

  const tokens = await generateTokens(user);
  return { user, tokens };
}

/**
 * Resends the 6-digit verification code.
 */
export async function resendVerificationCode(email: string): Promise<{ success: boolean; message: string }> {
  const user = await User.findOne({ email });
  
  if (!user) throw createApiError(404, "User not found");
  if (user.isVerified) throw createApiError(400, "Email is already verified");

  const code = crypto.randomInt(100000, 999999).toString();
  const hashedCode = await bcrypt.hash(code, 12);

  user.verificationCode = hashedCode;
  user.verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
  await user.save();

  await sendVerificationEmail(email, code);
  
  return { success: true, message: "New verification code sent" };
}

/**
 * Authenticate user and return tokens
 *
 * @param input - Login credentials (email, password)
 * @returns User data and authentication tokens
 * @throws ApiError 401 if credentials are invalid
 */
export async function login(
  input: LoginInput,
): Promise<{ user: Partial<IUser>; tokens: AuthTokens }> {
  // Find user and include password field for comparison
  const user = await User.findOne({ email: input.email }).select("+password");

  // Use generic error message to prevent user enumeration attacks
  if (!user) {
    throw createApiError(401, "Invalid email or password");
  }

  const isPasswordValid = await user.comparePassword(input.password);
  if (!isPasswordValid) {
    throw createApiError(401, "Invalid email or password");
  }

  // Generate new tokens for this session
  const tokens = await generateTokens(user);

  return { user, tokens };
}

/**
 * Refresh expired access token using refresh token
 * Implements token rotation: old refresh token is invalidated
 *
 * @param oldRefreshToken - Current refresh token
 * @returns New pair of tokens
 * @throws ApiError 401 if token is invalid or expired
 */
export async function refreshToken(
  oldRefreshToken: string,
): Promise<AuthTokens> {
  // Verify refresh token exists in database
  const storedToken = await RefreshToken.findOne({ token: oldRefreshToken });
  if (!storedToken) {
    throw createApiError(401, "Invalid refresh token");
  }

  if (storedToken.expiresAt < new Date()) {
    await RefreshToken.deleteOne({ _id: storedToken._id });
    throw createApiError(401, "Refresh token expired");
  }

  await RefreshToken.deleteOne({ _id: storedToken._id });

  const user = await User.findById(storedToken.userId);
  if (!user) {
    throw createApiError(401, "User not found");
  }

  // Generate new token pair
  return generateTokens(user);
}

/**
 * Logout user by invalidating their refresh token
 *
 * @param refreshToken - Token to invalidate
 */
export async function logout(refreshToken: string): Promise<void> {
  await RefreshToken.deleteOne({ token: refreshToken });
}

/**
 * Get current user by ID
 *
 * @param userId - User ID from JWT payload
 * @returns User data without sensitive fields
 * @throws ApiError 404 if user not found
 */
export async function getCurrentUser(userId: string): Promise<Partial<IUser>> {
  const user = await User.findById(userId);
  if (!user) {
    throw createApiError(404, "User not found");
  }
  return user.toJSON() as unknown as Partial<IUser>;
}

/**
 * Admin-specific login — same as login() but additionally enforces role === 'admin'.
 * Gives a clear "Access denied" error instead of letting a non-admin authenticate
 * and then fail silently on the first protected admin API call.
 *
 * @param input - Login credentials (email, password)
 * @returns Admin user data and authentication tokens
 * @throws ApiError 401 if credentials are invalid
 * @throws ApiError 403 if account exists but is not an admin
 */
export async function adminLogin(
  input: LoginInput,
): Promise<{ user: Partial<IUser>; tokens: AuthTokens }> {
  const user = await User.findOne({ email: input.email }).select("+password");

  // Use generic message for wrong email — prevents user enumeration
  if (!user) {
    throw createApiError(401, "Invalid email or password");
  }

  const isPasswordValid = await user.comparePassword(input.password);
  if (!isPasswordValid) {
    throw createApiError(401, "Invalid email or password");
  }

  // Role check is AFTER password verification — prevents leaking whether
  // a non-admin email exists by keeping error responses consistent
  if (user.role !== "admin") {
    throw createApiError(403, "Access denied: admin accounts only");
  }

  const tokens = await generateTokens(user);
  return { user, tokens };
}

