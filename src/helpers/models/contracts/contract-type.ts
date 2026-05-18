import {defineEntity, EntityManager, p} from "@mikro-orm/core";
import {Season} from "@/helpers/models/season/season";

/**
 * Represents a type of contract. Decides the type's icon and which channels do reviews go.
 */
export const ContractTypeSchema = defineEntity({
    name: "ContractType",
    tableName: "contract_types",
    properties: {
        id: p.bigint().primary(),
        season: () => p.manyToOne(Season).mapToPk().joinColumn("season").referenceColumnName("id"),
        name: p.string(),
        slug: p.string().length(16),
        icon: p.string(),
        discordChannelId: p.string(),

        // timeline
        assignmentStart: p.datetime(),
        assignmentEnd: p.datetime(),
        reviewDeadline: p.datetime(),

        createdAt: p.datetime().onCreate(() => new Date()),
        updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date()),
    },
    indexes: [
        {
            properties: ["season", "slug"],
            type: "unique",
        },
    ],
});

export class ContractType extends ContractTypeSchema.class {
    static async getContractTypeById(em: EntityManager, seasonId: string, idOrSlug: string) {
        try {
            const id = BigInt(idOrSlug);
            return em.findOne(ContractType, {id, season: seasonId});
        } catch (e) {
            return em.findOne(ContractType, {season: seasonId, slug: idOrSlug});
        }
    }
}

ContractTypeSchema.setClass(ContractType);
