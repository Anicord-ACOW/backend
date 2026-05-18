import {readFileSync} from "fs";
import jwt, {JwtPayload, SignOptions, VerifyOptions} from "jsonwebtoken";

const DEFAULT_TOKEN_EXPIRY = 604800;
const DEFAULT_ALGORITHM = "RS512" as jwt.Algorithm;

function getJwtPrivateKey() {
  const keyPath = process.env.JWT_PRIVATE_KEY_PATH || "/run/secrets/jwt_private_key";
  if (!keyPath) throw new Error("JWT_PRIVATE_KEY_PATH must be set");
  return readFileSync(keyPath, "utf8");
}

function getJwtPublicKey() {
  const keyPath = process.env.JWT_PUBLIC_KEY_PATH || "/run/secrets/jwt_public_key";
  if (!keyPath) throw new Error("JWT_PUBLIC_KEY_PATH must be set");
  return readFileSync(keyPath, "utf8");
}

export function createAuthToken(payload: JwtPayload, options: SignOptions = {}) {
  return jwt.sign(payload, getJwtPrivateKey(), {
    algorithm: DEFAULT_ALGORITHM,
    expiresIn: process.env.JWT_EXPIRES_IN ?? DEFAULT_TOKEN_EXPIRY,
    ...options,
  } as SignOptions);
}

export function verifyAuthToken<T extends JwtPayload = JwtPayload>(
  token: string,
  options: VerifyOptions = {},
) {
  const decoded = jwt.verify(token, getJwtPublicKey(), {
    algorithms: [DEFAULT_ALGORITHM],
    ...options,
  });

  if (typeof decoded === "string") throw new Error("JWT payload must be an object");
  return decoded as T & JwtPayload;
}
