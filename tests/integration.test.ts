import {type Server} from "node:http";
import type {Express} from "express";
import {afterAll, beforeAll, describe, expect, it, vi} from "vitest";
import {createAuthToken} from "@/helpers/auth-tokens";

let server: Server;
let baseUrl: string;
let db: Awaited<ReturnType<typeof import("./helpers/mock-db").createMockDb>>;
let closeAppDatabase: () => Promise<void>;
let originalMysql: string | undefined;

describe("integration test", () => {
    /**
     * Test timeline:
     * 2026-05-12T16:00:00.000Z - server starts, create season and contract types
     * 2026-05-13T00:00:00.000Z - season signups start
     * 2026-05-14T00:00:00.000Z - season signups end
     * 2026-05-15T00:00:00.000Z - contract deadline
     */
    beforeAll(async () => {
        // create db
        const {createMockDb} = await import("./helpers/mock-db");
        db = await createMockDb();
        originalMysql = process.env.MYSQL;
        process.env.MYSQL = db.clientUrl;
        console.log(`Using test database: ${db.clientUrl}`);

        const app = (await import("@/app")).default as Express;
        const {closeDatabase} = await import("@/helpers/db");
        closeAppDatabase = closeDatabase;

        // start server
        await new Promise<void>((resolve, reject) => {
            server = app.listen(0, () => {
                const address = server.address();
                if (address === null || typeof address === "string") {
                    reject(new Error("Failed to bind test server"));
                    return;
                }

                baseUrl = `http://127.0.0.1:${address.port}`;
                console.log(`Test server listening on ${baseUrl}`);
                resolve();
            });
        });

        vi.setSystemTime("2026-05-12T16:00:00.000Z");
    }, 20000);

    afterAll(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
        await closeAppDatabase();
        await db.close();

        if (originalMysql === undefined) {
            delete process.env.MYSQL;
        } else {
            process.env.MYSQL = originalMysql;
        }
    }, 20000);

    it("returns the success flag and message", async () => {
        const response = await fetch(`${baseUrl}/`);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            success: true,
            message: "Did you read the README?",
        });
    });

    it("returns the correct user data", async () => {
        const token = createAuthToken({sub: "1"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/users/me`, {
            headers: {
                Authorization: token,
            },
        });
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            success: true,
            user: {
                id: "1",
                username: "admin1",
                roles: [
                    "admin"
                ]
            }
        });

        const response2 = await fetch(`${baseUrl}/users/2`, {
            headers: {
                Authorization: token,
            },
        });
        const body2 = await response2.json();
        expect(response2.status).toBe(200);
        expect(body2).toMatchObject({
            success: true,
            user: {
                id: "2",
                username: "user2",
            }
        });
    });

    it("doesn't allow non admins to create seasons", async () => {
        const token = createAuthToken({sub: "2"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/seasons`, {
            method: "POST",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "Test Season",
                signupsStart: "2026-05-13T00:00:00.000Z",
                signupsEnd: "2026-05-14T00:00:00.000Z",
            }),
        });
        expect(response.status).toBe(403);
    });

    it("doesn't allow inconsistent dates", async () => {
        vi.setSystemTime("2026-05-12T16:00:00.000Z");

        const token = createAuthToken({sub: "1"}, {expiresIn: "1m"});
        // signups before now
        const response = await fetch(`${baseUrl}/seasons`, {
            method: "POST",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "Real Season",
                signupsStart: "2026-05-12T00:00:00.000Z",
                signupsEnd: "2026-05-14T00:00:00.000Z",
            }),
        });
        expect(response.status).toBe(400);

        // signup ends before starting
        const response2 = await fetch(`${baseUrl}/seasons`, {
            method: "POST",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "Real Season",
                signupsStart: "2026-05-15T00:00:00.000Z",
                signupsEnd: "2026-05-14T00:00:00.000Z",
            }),
        });
        expect(response2.status).toBe(400);
    });

    it("allows admins to create seasons", async () => {
        const token = createAuthToken({sub: "1"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/seasons`, {
            method: "POST",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "Real Season",
                signupsStart: "2026-05-13T00:00:00.000Z",
                signupsEnd: "2026-05-14T00:00:00.000Z",
            })
        });
        expect(response.status).toBe(200);
    });

    it("doesn't allow season creation if the season is already in progress", async () => {
        const token = createAuthToken({sub: "1"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/seasons`, {
            method: "POST",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "Real Season",
                signupsStart: new Date(Date.now() + 60000).toISOString(),
                signupsEnd: new Date(Date.now() + 120000).toISOString(),
            })
        });
        const body = await response.json();
        expect(response.status).toBe(400);
        expect(body).toMatchObject({
            success: false,
            error: "Cannot create a new season while there is an active season",
        });
    });

    it("returns the correct season data", async () => {
        const response = await fetch(`${baseUrl}/seasons/1`);
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            success: true,
            season: {
                id: "1",
                name: "Real Season",
                completed: false,
            },
        });
    });

    it("returns the correct season data", async () => {
        const response = await fetch(`${baseUrl}/seasons/current`);
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            success: true,
            season: {
                id: "1",
                name: "Real Season",
                completed: false,
            },
        });
    });

    it("allows users to update their signup form", async () => {
        const token = createAuthToken({sub: "2"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/users/me/signup-form`, {
            method: "PATCH",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                repServer: "Frieren",
                pcPower: "POTATO",
                preferredGameGenres: ["DATING", "FIGHTING"],
            }),
        });
        expect(response.status).toBe(200);
    });

    it("doesn't allow allow users to update others' signup form", async () => {
        const token = createAuthToken({sub: "2"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/users/1/signup-form`, {
            method: "PATCH",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                repServer: "Frieren",
                pcPower: "POTATO",
                preferredGameGenres: ["DATING", "FIGHTING"],
            }),
        });
        expect(response.status).toBe(403);
    });

    it("doesn't allow allow users to retrieve others' signup form", async () => {
        const token = createAuthToken({sub: "2"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/users/1/signup-form`, {
            method: "GET",
            headers: {
                Authorization: token,
            },
        });
        expect(response.status).toBe(403);
    });

    it("allows allow admins to update others' signup form", async () => {
        const token = createAuthToken({sub: "1"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/users/2/signup-form`, {
            method: "PATCH",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                repServer: "Shibouyugi",
                preferredGameGenres: ["CASUAL"],
            }),
        });
        expect(response.status).toBe(200);
    });

    it("returns the correct signup form data", async () => {
        const token = createAuthToken({sub: "2"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/users/me/signup-form`, {
            method: "GET",
            headers: {
                Authorization: token,
            },
        });
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            success: true,
            form: {
                repServer: "Shibouyugi",
                pcPower: "POTATO",
                preferredGameGenres: ["CASUAL"],
            },
        });
    });

    it("doesn't allow users to signup before the signup period", async () => {
        const token = createAuthToken({sub: "2"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/seasons/1/signup`, {
            method: "POST",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        });
        const body = await response.json();
        expect(response.status).toBe(400);
        expect(body).toMatchObject({
            success: false,
            error: "Signups have not started",
        });
    });

    it("allow users to signup during the signup period", async () => {
        vi.setSystemTime("2026-05-13T00:00:00.001Z");

        // #2 signs up twice, we'll check for idempotency later
        const token = createAuthToken({sub: "2"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/seasons/1/signup`, {
            method: "POST",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        });
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            success: true,
        });

        const response2 = await fetch(`${baseUrl}/seasons/1/signup`, {
            method: "POST",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        });
        const body2 = await response2.json();
        expect(response2.status).toBe(200);
        expect(body2).toMatchObject({
            success: true,
        });

        // #1 and 3
        const token1 = createAuthToken({sub: "1"}, {expiresIn: "1m"});
        const response3 = await fetch(`${baseUrl}/seasons/1/signup`, {
            method: "POST",
            headers: {
                Authorization: token1,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        });
        const body3 = await response3.json();
        expect(response3.status).toBe(200);
        expect(body3).toMatchObject({
            success: true,
        });

        const token3 = createAuthToken({sub: "3"}, {expiresIn: "1m"});
        const response4 = await fetch(`${baseUrl}/seasons/1/signup`, {
            method: "POST",
            headers: {
                Authorization: token3,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        });
        const body4 = await response4.json();
        expect(response4.status).toBe(200);
        expect(body4).toMatchObject({
            success: true,
        });

        // #4-6
        for (let i = 4; i <= 6; ++i) {
            const token_ = createAuthToken({sub: `${i}`}, {expiresIn: "1m"});
            const response_ = await fetch(`${baseUrl}/seasons/1/signup`, {
                method: "POST",
                headers: {
                    Authorization: token_,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            });
            const body_ = await response_.json();
            expect(response_.status).toBe(200);
            expect(body_).toMatchObject({
                success: true,
            });
        }
    });

    it("allows users to remove signup during the signup period", async () => {
        const token3 = createAuthToken({sub: "3"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/seasons/1/signup`, {
            method: "DELETE",
            headers: {
                Authorization: token3,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        });
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            success: true,
        });

        const response4 = await fetch(`${baseUrl}/seasons/1/signup`, {
            method: "DELETE",
            headers: {
                Authorization: token3,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        });
        const body4 = await response4.json();
        expect(response4.status).toBe(200);
        expect(body4).toMatchObject({
            success: true,
        });
    });

    it("returns the correct signup status", async () => {
        const token = createAuthToken({sub: "1"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/seasons/1/signup`, {
            method: "GET",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
        });
        const body = await response.json();
        expect(body).toMatchObject({
            success: true,
            signedUp: true,
        });

        const token3 = createAuthToken({sub: "3"}, {expiresIn: "1m"});
        const response3 = await fetch(`${baseUrl}/seasons/1/signup`, {
            method: "GET",
            headers: {
                Authorization: token3,
                "Content-Type": "application/json",
            },
        });
        const body3 = await response3.json();
        expect(body3).toMatchObject({
            success: true,
            signedUp: false,
        });
    });

    // 1-6 all signed up initially, but 3 removed, so 5 signups left
    it("signups are idempotent", async () => {
        const token = createAuthToken({sub: "1"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/seasons/1/signups`, {
            method: "GET",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
        });
        const body = await response.json();
        expect(body.signups.filter((x: any) => x.user.id === "2").length).toBe(1);
        expect(body.signups.filter((x: any) => x.user.id === "1").length).toBe(1);
        expect(body.signups.length).toBe(5);
    });

    it("doesn't allow users to change signup after the signup period", async () => {
        vi.setSystemTime("2026-05-14T00:00:00.001Z");

        const token3 = createAuthToken({sub: "4"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/seasons/1/signup`, {
            method: "DELETE",
            headers: {
                Authorization: token3,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        });
        const body = await response.json();
        expect(response.status).toBe(400);
        expect(body).toMatchObject({
            success: false,
        });

        const token = createAuthToken({sub: "3"}, {expiresIn: "1m"});
        const response2 = await fetch(`${baseUrl}/seasons/1/signup`, {
            method: "POST",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        });
        const body2 = await response2.json();
        expect(response2.status).toBe(400);
        expect(body2).toMatchObject({
            success: false,
        });
    });

    it("allows only admins to create contract types", async () => {
        for (let i of [1, 2]) {
            const token = createAuthToken({sub: `${i}`}, {expiresIn: "1m"});
            const response = await fetch(`${baseUrl}/seasons/1/contract-types`, {
                method: "POST",
                headers: {
                    Authorization: token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: "Base Contract",
                    slug: "base",
                    icon: "kirby",
                    discordChannelId: "1077741836749242468",

                    assignmentStart: "2026-05-15T00:00:00.000Z",
                    assignmentEnd: "2026-05-16T00:00:00.000Z",
                    reviewDeadline: "2026-05-23T00:00:00.000Z",
                })
            });
            const body = await response.json();
            expect(response.status).toBe(i === 1 ? 200 : 403);
            expect(body.success).toBe(i === 1);
        }
    });

    it("doesn't allow inconsistent dates in contract types", async () => {
        const token = createAuthToken({sub: "1"}, {expiresIn: "1m"});
        const ranges = [
            // starts in the past
            {
                assignmentStart: "2026-05-13T00:00:00.000Z",
                assignmentEnd: "2026-05-16T00:00:00.000Z",
                reviewDeadline: "2026-05-23T00:00:00.000Z",
            },
            // starts after end
            {
                assignmentStart: "2026-05-19T00:00:00.000Z",
                assignmentEnd: "2026-05-16T00:00:00.000Z",
                reviewDeadline: "2026-05-23T00:00:00.000Z",
            },
            // deadline before assignment
            {
                assignmentStart: "2026-05-13T00:00:00.000Z",
                assignmentEnd: "2026-05-16T00:00:00.000Z",
                reviewDeadline: "2026-05-15T00:00:00.000Z",
            },
        ];
        for (let i of ranges) {
            const response = await fetch(`${baseUrl}/seasons/1/contract-types`, {
                method: "POST",
                headers: {
                    Authorization: token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: "Dating Contract",
                    slug: "dating",
                    icon: "heart",
                    discordChannelId: "1077741836749242468",

                    ...i,
                })
            });
            const body = await response.json();
            expect(response.status).toBe(400);
            expect(body.success).toBe(false);
        }
    });

    it("returns correct contract types", async () => {
        const token = createAuthToken({sub: "2"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/seasons/1/contract-types`, {
            method: "GET",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
        });
        const body = await response.json();
        expect(body).toMatchObject({
            success: true,
            contractTypes: [
                {
                    id: "1",
                    name: "Base Contract",
                    slug: "base",
                    icon: "kirby",
                    discordChannelId: "1077741836749242468",
                    assignmentStart: "2026-05-15T00:00:00.000Z",
                    assignmentEnd: "2026-05-16T00:00:00.000Z",
                    reviewDeadline: "2026-05-23T00:00:00.000Z",
                }
            ]
        });
    });

    it("allows admins to create contracts", async () => {
        // this is to get around the rate limit
        vi.setSystemTime("2026-05-14T00:01:00.001Z");
        const pairs = [[6, 5], [5, 4], [4, 2], [2, 1], [1, 6]];
        const token = createAuthToken({sub: "1"}, {expiresIn: "1m"});

        for (let pair of pairs) {
            const response = await fetch(`${baseUrl}/seasons/1/contract-types/base/contracts`, {
                method: "POST",
                headers: {
                    Authorization: token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contractor: pair[0],
                    contractee: pair[1],
                }),
            });
            const body = await response.json();
            console.log(body);
            expect(response.status).toBe(200);
            expect(body).toMatchObject({
                success: true,
                contract: {
                    season: "1",
                    contractType: {
                        slug: "base",
                    },
                    contractor: {id: pair[0].toString()},
                    contractee: {id: pair[1].toString()},
                }
            });
        }
    });

    it("doesn't allow non admins to create contracts", async () => {
        const token = createAuthToken({sub: "2"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/seasons/1/contract-types/base/contracts`, {
            method: "POST",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contractor: 4,
                contractee: 2,
            }),
        });
        const body = await response.json();
        expect(response.status).toBe(403);
        expect(body).toMatchObject({
            success: false,
        });
    });

    it("validates contract parties correctly", async () => {
        const token = createAuthToken({sub: "1"}, {expiresIn: "1m"});

        // contractor is not signed up, -ee is not signed up, same participant
        const pairs = [[3, 2], [2, 3], [2, 2]];
        for (let pair of pairs) {
            const response = await fetch(`${baseUrl}/seasons/1/contract-types/base/contracts`, {
                method: "POST",
                headers: {
                    Authorization: token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contractor: pair[0],
                    contractee: pair[1],
                }),
            });
            const body = await response.json();
            expect(response.status).toBe(400);
            expect(body).toMatchObject({
                success: false,
                error: pair[0] !== pair[1] ? "Both contractor and contractee must be signed up" : "Contractor and contractee must be distinct",
            });
        }
    });
});
