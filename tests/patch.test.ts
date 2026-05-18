import {AsyncLocalStorage} from "node:async_hooks";
import {beforeAll, describe, expect, it} from "vitest";
import {parseModelPatch} from "@/helpers/patch";
import {SignUpFormSchema} from "@/helpers/models/season/signup";
import {ContractSchema} from "@/helpers/models/contracts/contract";
import {ContractTypeSchema} from "@/helpers/models/contracts/contract-type";

const protectedSignupFields = ["id", "user", "userId"];
const protectedContractFields = ["season, contractType", "name", "progress", "score", "reviewContent", "verdict"];

describe("parseModelPatch", () => {
    beforeAll(async () => {
        (globalThis as typeof globalThis & {AsyncLocalStorage?: typeof AsyncLocalStorage}).AsyncLocalStorage = AsyncLocalStorage;
    });

    it("accepts partial objects matching editable model fields", () => {
        const result = parseModelPatch(
            {
                repServer: "Frieren",
                extremeSpecialParticipation: true,
                gameProfileUrl: null,
            },
            SignUpFormSchema,
            {exclude: protectedSignupFields},
        );

        expect(result).toEqual({
            repServer: "Frieren",
            extremeSpecialParticipation: true,
            gameProfileUrl: null,
        });
    });

    it("rejects non-object bodies", () => {
        expect(() => parseModelPatch(null, SignUpFormSchema)).toThrow("Invalid input: expected object, received null");
    });

    it("rejects unknown fields", () => {

        expect(() => parseModelPatch({admin: true}, SignUpFormSchema, {exclude: protectedSignupFields}))
            .toThrow("Unrecognized key");
    });

    it("rejects excluded property names and field names", () => {
        expect(() => parseModelPatch({id: 1}, SignUpFormSchema, {exclude: protectedSignupFields}))
            .toThrow("Unrecognized key");
        expect(() => parseModelPatch({userId: 1, repServer: "Frieren"}, SignUpFormSchema, {exclude: protectedSignupFields}))
            .toThrow("Unrecognized key");
    });

    it("rejects foreign key fields by default", () => {
        expect(() => parseModelPatch({user: 1}, SignUpFormSchema))
            .toThrow("Unrecognized key");
        expect(() => parseModelPatch({userId: 1, repServer: "Frieren"}, SignUpFormSchema))
            .toThrow("Unrecognized key");
    });

    it("rejects invalid field values", () => {
        expect(() => parseModelPatch(
            {extremeSpecialParticipation: "yes"},
            SignUpFormSchema,
            {exclude: protectedSignupFields},
        ))
            .toThrow("Invalid value for extremeSpecialParticipation");
    });

    it("rejects null values on non nullable field", () => {
        expect(() => parseModelPatch(
            {extremeSpecialParticipation: null},
            SignUpFormSchema,
            {exclude: protectedSignupFields},
        ))
            .toThrow("Invalid value for extremeSpecialParticipation");
    });

    it("accepts enum and enum array fields", () => {
        expect(parseModelPatch(
            {
                pcPower: "HIGH",
                preferredGameGenres: ["PLATFORMERS", "JRPGS"],
            },
            SignUpFormSchema,
            {exclude: protectedSignupFields},
        )).toEqual({
            pcPower: "HIGH",
            preferredGameGenres: ["PLATFORMERS", "JRPGS"],
        });
    });

    it("rejects invalid enum values", () => {
        expect(() => parseModelPatch(
            {pcPower: "TOASTER"},
            SignUpFormSchema,
            {exclude: protectedSignupFields},
        ))
            .toThrow("Invalid value for pcPower");
    });

    it("rejects invalid enum array values", () => {
        expect(() => parseModelPatch(
            {preferredGameGenres: ["PLATFORMERS", "NOT_A_GENRE"]},
            SignUpFormSchema,
            {exclude: protectedSignupFields},
        ))
            .toThrow("Invalid value for preferredGameGenres");
    });

    it("rejects partial models when partial is false", () => {
        expect(() => parseModelPatch(
            {preferredGameGenres: ["PLATFORMERS", "DATING"]},
            SignUpFormSchema,
            {exclude: protectedSignupFields, partial: false},
        ))
            .toThrow(/^Invalid value for /);
    });

    it("validates foreign key fields correctly", () => {
        expect(parseModelPatch(
            {contractor: 1},
            ContractSchema,
            {exclude: protectedContractFields, partial: true, excludeForeignKeyFields: false},
        )).toEqual({
            contractor: 1n,
        });
        expect(parseModelPatch(
            {contractor: "1"},
            ContractSchema,
            {exclude: protectedContractFields, partial: true, excludeForeignKeyFields: false},
        )).toEqual({
            contractor: 1n,
        });
        expect(() => parseModelPatch(
            {contractor: "aaa"},
            ContractSchema,
            {exclude: protectedContractFields, partial: true, excludeForeignKeyFields: false},
        )).toThrow("Invalid value for contractor");
    });

    it("validates dates", () => {
        expect(parseModelPatch(
            {
                assignmentStart: "2024-01-01T00:00:00.000Z",
                assignmentEnd: "2024-01-02T00:00:00.000Z",
                reviewDeadline: "2024-01-03T00:00:00.000Z",
            },
            ContractTypeSchema,
        )).toEqual({
            assignmentStart: new Date("2024-01-01T00:00:00.000Z"),
            assignmentEnd: new Date("2024-01-02T00:00:00.000Z"),
            reviewDeadline: new Date("2024-01-03T00:00:00.000Z"),
        });
    });
});
