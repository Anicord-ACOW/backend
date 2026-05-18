import {Collection, defineEntity, p} from "@mikro-orm/core";

export const UserSchema = defineEntity({
    name: "User",
    properties: {
        id: p.bigint().primary(),
        username: p.string(),
        roles: () => p.oneToMany(RoleSchema)
            .mappedBy("user")
            .serializer((roles) => (roles as unknown as Collection<Role>).getItems(false).map((role) => role.role)),
        createdAt: p.datetime().onCreate(() => new Date()),
        updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date()),
    },
});

export class User extends UserSchema.class {}

UserSchema.setClass(User);

export const RoleSchema = defineEntity({
    name: "Role",
    tableName: "roles",
    properties: {
        user: () => p.manyToOne(User)
            .primary()
            .joinColumn("user")
            .referenceColumnName("id")
            .inversedBy("roles"),
        role: p.string().primary(),
    },
    compositePK: true,
});

export class Role extends RoleSchema.class {}

RoleSchema.setClass(Role);
