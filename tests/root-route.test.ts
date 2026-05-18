import {AsyncLocalStorage} from "node:async_hooks";
import {type Server} from "node:http";
import type {Express} from "express";
import {afterAll, beforeAll, describe, expect, it} from "vitest";

let server: Server;
let baseUrl: string;

describe("root route", () => {
    beforeAll(async () => {
        const app = (await import("@/app")).default as Express;

        await new Promise<void>((resolve, reject) => {
            server = app.listen(0, () => {
                const address = server.address();
                if (address === null || typeof address === "string") {
                    reject(new Error("Failed to bind test server"));
                    return;
                }

                baseUrl = `http://127.0.0.1:${address.port}`;
                resolve();
            });
        });
    });

    afterAll(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
    });

    it("returns the success flag and message", async () => {
        const response = await fetch(`${baseUrl}/`);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            success: true,
            message: "Did you read the README?",
        });
    });
});
