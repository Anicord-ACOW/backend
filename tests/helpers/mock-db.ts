import {execFile as execFileCallback, spawn} from "node:child_process";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {promisify} from "node:util";
import {createServer, type AddressInfo} from "node:net";
import {MikroORM, defineConfig} from "@mikro-orm/mariadb";
import {BadgeSchema} from "@/helpers/models/badges/badge";
import {BadgeProgressSchema} from "@/helpers/models/badges/badge-progress";
import {ContractSchema} from "@/helpers/models/contracts/contract";
import {ContractTypeSchema} from "@/helpers/models/contracts/contract-type";
import {SeasonSchema} from "@/helpers/models/season/season";
import {SignUpFormSchema, SignUpSchema} from "@/helpers/models/season/signup";
import {Role, RoleSchema, User, UserSchema} from "@/helpers/models/user";

const execFile = promisify(execFileCallback);

const testEntities = [
    UserSchema,
    RoleSchema,
    SignUpFormSchema,
    SignUpSchema,
    BadgeSchema,
    BadgeProgressSchema,
    ContractSchema,
    ContractTypeSchema,
    SeasonSchema,
];

export type MockDb = Awaited<ReturnType<typeof createMockDb>>;

async function findFreePort() {
    const server = createServer();

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address() as AddressInfo;

    await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
    });

    return address.port;
}

async function waitForMariaDb(port: number) {
    const args = [
        "--protocol=tcp",
        "--host=127.0.0.1",
        `--port=${port}`,
        "--user=root",
        "ping",
    ];

    for (let attempt = 0; attempt < 100; attempt += 1) {
        console.log(`Waiting for MariaDB to start (attempt ${attempt})`);
        try {
            await execFile("mariadb-admin", args);
            return;
        } catch (e) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    throw new Error("Timed out waiting for mock MariaDB to start");
}

async function stopMariaDb(process: ReturnType<typeof spawn>) {
    if (process.exitCode !== null || process.signalCode !== null) return;

    process.kill("SIGTERM");

    await Promise.race([
        new Promise<void>(resolve => process.once("exit", () => resolve())),
        new Promise<void>(resolve => setTimeout(resolve, 5000)).then(() => {
            if (process.exitCode === null && process.signalCode === null) {
                process.kill("SIGKILL");
            }
        }),
    ]);
}

export async function createMockDb() {
    const rootDir = await mkdtemp(path.join(tmpdir(), "acow-mariadb-"));
    const dataDir = path.join(rootDir, "data");
    const socketPath = path.join(rootDir, "mariadb.sock");
    const port = await findFreePort();

    await execFile("mariadb-install-db", [
        "--no-defaults",
        `--datadir=${dataDir}`,
        "--auth-root-authentication-method=normal",
        "--skip-test-db",
    ]);

    const server = spawn("mariadbd", [
        "--no-defaults",
        `--datadir=${dataDir}`,
        `--socket=${socketPath}`,
        `--port=${port}`,
        "--bind-address=127.0.0.1",
        "--skip-networking=0",
        "--skip-log-bin",
        `--pid-file=${path.join(rootDir, "mariadb.pid")}`,
        `--log-error=${path.join(rootDir, "mariadb.err")}`,
    ]);

    try {
        console.log(`Waiting for MariaDB to start on port ${port} at ${rootDir}`);
        await waitForMariaDb(port);
        console.log("MariaDB started");

        const orm = await MikroORM.init(defineConfig({
            clientUrl: `mysql://root@127.0.0.1:${port}/acow_test`,
            entities: testEntities,
            debug: false,
        }));

        await orm.schema.ensureDatabase();
        await orm.schema.create();

        const em = orm.em.fork();
        const admin = em.create(User, {
            id: BigInt(1),
            username: "admin1",
        });
        em.create(Role, {
            user: admin,
            role: "admin",
        });
        for (let i = 0; i < 10; ++i) {
            const user = em.create(User, {
                id: BigInt(i + 2),
                username: `user${i + 2}`,
            });
        }
        await em.flush();

        return {
            orm,
            rootDir,
            clientUrl: `mysql://root@127.0.0.1:${port}/acow_test`,
            em: () => orm.em.fork(),
            async close() {
                await orm.close(true);
                await stopMariaDb(server);
                await rm(rootDir, {recursive: true, force: true});
            },
        };
    } catch (error) {
        await stopMariaDb(server);
        await rm(rootDir, {recursive: true, force: true});
        throw error;
    }
}
