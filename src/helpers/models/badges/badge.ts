import {defineEntity, p} from "@mikro-orm/core";

/**
 * Represents a badge that a user can earn. Usually represents an achievement.
 */
export const BadgeSchema = defineEntity({
    name: "Badge",
    tableName: "badges",
    properties: {
        id: p.bigint().primary(),
        name: p.string().default(""),
        // this could be the id of an image within the repo or a url to a cdn
        imageId: p.string().default(""),
        description: p.string().default(""),
        objective: p.string().default(""),

        createdAt: p.datetime().onCreate(() => new Date()),
        updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date()),
    },
});

export class Badge extends BadgeSchema.class {}

BadgeSchema.setClass(Badge);
