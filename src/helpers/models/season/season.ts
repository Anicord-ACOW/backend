import {defineEntity, EntityManager, p} from "@mikro-orm/core";
import {ContractTypeSchema} from "@/helpers/models/contracts/contract-type";

/**
 * Represents a season of the contracts event.
 */
export const SeasonSchema = defineEntity({
    name: "Season",
    tableName: "seasons",
    properties: {
        id: p.bigint().primary(),
        name: p.string(),
        // signup period
        signupsStart: p.datetime(),
        signupsEnd: p.datetime(),

        completed: p.boolean().default(false),

        contractTypes: () => p.oneToMany(ContractTypeSchema).mappedBy("season"),

        createdAt: p.datetime().onCreate(() => new Date()),
        updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date()),
    },
});

export class Season extends SeasonSchema.class {
    static getSeasonById(em: EntityManager, seasonId: string) {
        if (seasonId === "current") {
            return em.findOne(Season, {completed: false}, {orderBy: {id: "desc"}});
        } else {
            return em.findOne(Season, seasonId);
        }
    }
}

SeasonSchema.setClass(Season);
