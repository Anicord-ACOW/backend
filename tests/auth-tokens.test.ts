import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {generateKeyPairSync} from "crypto";
import {mkdtempSync, rmSync, writeFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";
import {createAuthToken, verifyAuthToken} from "@/helpers/auth-tokens";

const originalEnv = process.env;
let tempDir: string;
let privateKeyPath: string;
let publicKeyPath: string;
let otherPublicKeyPath: string;

const keyPair = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
  },
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
});
const otherKeyPair = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
  },
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
});

describe("auth", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "acow-auth-"));
    privateKeyPath = join(tempDir, "jwt-private.pem");
    publicKeyPath = join(tempDir, "jwt-public.pem");
    otherPublicKeyPath = join(tempDir, "other-jwt-public.pem");
    writeFileSync(privateKeyPath, keyPair.privateKey);
    writeFileSync(publicKeyPath, keyPair.publicKey);
    writeFileSync(otherPublicKeyPath, otherKeyPair.publicKey);

    process.env = {...originalEnv};
    process.env.JWT_PRIVATE_KEY_PATH = privateKeyPath;
    process.env.JWT_PUBLIC_KEY_PATH = publicKeyPath;
    delete process.env.JWT_EXPIRES_IN;
  });

  afterEach(() => {
    process.env = originalEnv;
    rmSync(tempDir, {recursive: true, force: true});
  });

  it("creates and verifies auth tokens", () => {
    const token = createAuthToken({userId: "123", role: "member"});
    const payload = verifyAuthToken<{userId: string, role: string}>(token);

    expect(payload.userId).toBe("123");
    expect(payload.role).toBe("member");
    expect(payload.iat).toEqual(expect.any(Number));
    expect(payload.exp).toEqual(expect.any(Number));
  });

  it("rejects tokens signed with a different private key", () => {
    const token = createAuthToken({userId: "123"});

    process.env.JWT_PUBLIC_KEY_PATH = otherPublicKeyPath;

    expect(() => verifyAuthToken(token)).toThrow();
  });

  it("requires JWT_PRIVATE_KEY_PATH to exist to create tokens", () => {
    delete process.env.JWT_PRIVATE_KEY_PATH;

    expect(() => createAuthToken({userId: "123"})).toThrow(/^ENOENT: /);
  });

  it("requires JWT_PUBLIC_KEY_PATH to exist to verify tokens", () => {
    const token = createAuthToken({userId: "123"});

    delete process.env.JWT_PUBLIC_KEY_PATH;

    expect(() => verifyAuthToken(token)).toThrow(/^ENOENT: /);
  });
});
