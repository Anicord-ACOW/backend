import {defineEntity, p} from "@mikro-orm/core";
import {User} from "@/helpers/models/user";
import {ContractType} from "@/helpers/models/contracts/contract-type";
import {Season} from "@/helpers/models/season/season";

/**
 * Represents a contract that a participant must complete to obtain a pass.
 */
export const ContractSchema = defineEntity({
    name: "Contract",
    tableName: "contracts",
    properties: {
        id: p.bigint().primary(),
        season: () => p.manyToOne(Season).mapToPk().joinColumn("season").referenceColumnName("id"),
        contractor: () => p.manyToOne(User).joinColumn("contractor").referenceColumnName("id"),
        contractee: () => p.manyToOne(User).joinColumn("contractee").referenceColumnName("id"),
        contractType: () => p.manyToOne(ContractType).joinColumn("contract_type").referenceColumnName("id"),

        // the actual series/game/dish/etc to complete, eg "Shibouyugi (Anime)"
        name: p.string().default(""),
        progress: p.string().default(""),
        // normally scores should be a number but people like stuff such as "69/420", i shall oblige
        score: p.string().default(""),
        reviewContent: p.string().default(""),
        verdict: p.enum(["PASS", "LATE_PASS", "FAIL", "PENDING"]).default("PENDING"),

        createdAt: p.datetime().onCreate(() => new Date()),
        updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date()),
    },
});

export class Contract extends ContractSchema.class {}

ContractSchema.setClass(Contract);
