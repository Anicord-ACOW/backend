import {defineEntity, p} from "@mikro-orm/core";
import {Badge} from "./badge";

/**
 * Represents a user's progress towards earning a badge. The user possesses the badge only after progress is >=100%.
 */
export const BadgeProgressSchema = defineEntity({
    name: "BadgeProgress",
    tableName: "badge_progress",
    properties: {
        id: p.bigint().primary(),
        badge: () => p.manyToOne(Badge).joinColumn("badge").referenceColumnName("id"),
        progress: p.integer().default(0),

        createdAt: p.datetime().onCreate(() => new Date()),
        updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date()),
    },
});

export class BadgeProgress extends BadgeProgressSchema.class {}

BadgeProgressSchema.setClass(BadgeProgress);
