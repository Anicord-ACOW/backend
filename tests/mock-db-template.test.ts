import {AsyncLocalStorage} from "node:async_hooks";
import {afterAll, beforeAll, describe, expect, it} from "vitest";

let db: Awaited<ReturnType<typeof import("./helpers/mock-db").createMockDb>>;
let User: typeof import("@/helpers/models/user").User;

describe("mock database template", () => {
    beforeAll(async () => {
        User = (await import("@/helpers/models/user")).User;
        const {createMockDb} = await import("./helpers/mock-db");
        db = await createMockDb();
    });

    afterAll(async () => {
        await db.close();
    });

    it("seeds the admin user and role", async () => {
        const user = await db.em().findOneOrFail(User, BigInt(1), {
            populate: ["roles"],
        });

        expect(user.username).toBe("admin1");
        expect(user.roles.getItems().map(role => role.role)).toEqual(["admin"]);
    });
});
