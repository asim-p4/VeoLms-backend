import { User, IUser } from "../models/User";
import { RefreshToken } from "../models/RefreshToken";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import { createApiError } from "../utils/ApiError";
import { SignupInput, LoginInput, AuthTokens } from "../types/authTypes";

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
 * Register a new user account
 *
 * @param input - User signup data (name, email, password)
 * @returns Created user and authentication tokens
 * @throws ApiError 409 if email already exists
 */
export async function userSignup(
  input: SignupInput,
): Promise<{ user: IUser; tokens: AuthTokens }> {
  const { email, name, password } = input;
  // Check for existing user to prevent duplicate accounts
  const existingUser = await User.findOne({ email: input.email });
  if (existingUser) {
    // Fixed: was `throw { statusCode, message }` plain object which bypassed the
    // global error handler's instanceof check, causing a 500 instead of 409.
    throw createApiError(409, "An account with this email already exists");
  }

  // Create user (password is hashed by Mongoose pre-save hook)

  const user = await User.create({
    name,
    email,
    password,
  });
  // Generate authentication tokens
  const tokens = await generateTokens(user);

  return { user, tokens };
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

  return { user: user.toJSON() as unknown as Partial<IUser>, tokens };
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
