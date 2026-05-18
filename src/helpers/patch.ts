import type {EntityProperty, EntitySchema} from "@mikro-orm/core";
import {EntitySchema as MikroEntitySchema} from "@mikro-orm/core";
import {z} from "zod";
import {APIError} from "@/helpers/api-error";

type ModelPatchOptions = {
    exclude?: readonly string[];
    excludeManagedFields?: boolean;
    excludeForeignKeyFields?: boolean;
    partial?: boolean;
};

function propertyMatchesName(prop: EntityProperty, names: Set<string>) {
    return [
        prop.name,
        ...(prop.fieldNames ?? []),
        ...(prop.joinColumns ?? []),
    ].some(name => names.has(String(name)));
}

function isForeignKeyProperty(prop: EntityProperty) {
    return prop.kind !== undefined && prop.kind !== "scalar";
}

function shouldSkipProperty(
    prop: EntityProperty,
    excluded: Set<string>,
    excludeManagedFields: boolean,
    excludeForeignKeyFields: boolean,
) {
    if (propertyMatchesName(prop, excluded)) return true;
    if (excludeManagedFields && (prop.primary || prop.onCreate || prop.onUpdate)) return true;
    if (excludeForeignKeyFields && isForeignKeyProperty(prop)) return true;
    return false;
}

function inferRuntimeType(prop: EntityProperty) {
    if (prop.runtimeType) return prop.runtimeType;
    const type = prop.type as unknown;
    if (typeof type === "string") return type;
    if (typeof type === "function") return type.name;
    if (typeof type === "object" && type !== null) return type.constructor.name;
    return undefined;
}

function relationTargetSchema(prop: EntityProperty) {
    if (typeof prop.entity !== "function") return null;

    const target = prop.entity();
    if (MikroEntitySchema.is(target)) return target;

    return MikroEntitySchema.REGISTRY.get(target) ?? null;
}

function zodForRelationProperty(prop: EntityProperty): z.ZodType | null {
    const targetSchema = relationTargetSchema(prop);
    if (!targetSchema) return null;
    const targetPk = Object.entries(targetSchema.meta.properties).filter(([, v]) => v.primary);
    if (targetPk.length === 0) return null;

    if (targetPk.length === 1) {
        const [targetPkName, targetPkProp] = targetPk[0] as [string, EntityProperty];
        return zodForProperty({
            ...targetPkProp,
            name: targetPkProp.name ?? targetPkName,
            nullable: prop.nullable,
        });
    }

    // this is here for fun as it's unlikely to work in the db since you can't stuff 2 fields in 1
    /*
    const shape: Record<string, z.ZodType> = {};
    for (const [targetPkName, targetPkProp] of targetPk as [string, EntityProperty][]) {
        const pkProp = {
            ...targetPkProp,
            name: targetPkProp.name ?? targetPkName,
            nullable: false,
        };
        const pkSchema = zodForProperty(pkProp);
        if (!pkSchema) return null;
        shape[pkProp.name] = pkSchema;
    }

    const schema = z.object(shape).strict();
    return prop.nullable ? schema.nullable() : schema;
    */
    return null;
}

function zodForEnumProperty(prop: EntityProperty) {
    if (!Array.isArray(prop.items)) return null;

    const itemSchema = z.custom(value => prop.items!.includes(value as never));
    return prop.array ? z.array(itemSchema) : itemSchema;
}

function zodForScalarProperty(prop: EntityProperty) {
    let schema: z.ZodType;

    if (prop.kind !== undefined && prop.kind !== "scalar" && !prop.mapToPk) {
        return null;
    }

    if (prop.enum) {
        const enumSchema = zodForEnumProperty(prop);
        if (!enumSchema) return null;
        return prop.nullable ? enumSchema.nullable() : enumSchema;
    }

    switch (inferRuntimeType(prop)) {
        case "string":
        case "String":
        case "StringType":
        case "TextType":
        case "UuidType":
        case "CharacterType":
            schema = z.string();
            break;
        case "boolean":
        case "Boolean":
        case "BooleanType":
            schema = z.boolean();
            break;
        case "number":
        case "Number":
        case "IntegerType":
        case "SmallIntType":
        case "TinyIntType":
        case "MediumIntType":
        case "FloatType":
        case "DoubleType":
            schema = z.number();
            break;
        case "bigint":
        case "BigInt":
        case "BigIntType":
            schema = z.union([
                z.bigint(),
                z.string().regex(/^-?\d+$/).transform(value => BigInt(value)),
                z.number().int().transform(value => BigInt(value)),
            ]);
            break;
        case "Date":
        case "DateType":
        case "DateTimeType":
            schema = z.coerce.date();
            break;
        default:
            return null;
    }

    return prop.nullable ? schema.nullable() : schema;
}

function zodForProperty(prop: EntityProperty): z.ZodType | null {
    if (prop.kind !== undefined && prop.kind !== "scalar") {
        return zodForRelationProperty(prop);
    }

    return zodForScalarProperty(prop);
}

function firstIssueMessage(error: z.ZodError) {
    const issue = error.issues[0];
    if (!issue) return "Invalid request body";

    const field = issue.path[0] === undefined ? undefined : String(issue.path[0]);
    return field ? `Invalid value for ${field}` : issue.message;
}

export function parseModelPatch<TEntity extends object>(
    body: unknown,
    schema: EntitySchema<TEntity>,
    options: ModelPatchOptions = {},
): Partial<TEntity> {
    const excluded = new Set(options.exclude ?? []);
    excluded.add("id");
    excluded.add("createdAt");
    excluded.add("updatedAt");
    const excludeManagedFields = options.excludeManagedFields ?? true;
    const excludeForeignKeyFields = options.excludeForeignKeyFields ?? true;
    const shape: Record<string, z.ZodType> = {};

    for (const [propertyName, rawProp] of Object.entries(schema.meta.properties) as [string, EntityProperty][]) {
        const prop = {
            ...rawProp,
            name: rawProp.name ?? propertyName,
        };
        if (shouldSkipProperty(prop, excluded, excludeManagedFields, excludeForeignKeyFields)) continue;

        const propSchema = zodForProperty(prop);
        if (propSchema) shape[prop.name] = propSchema;
    }

    // const patchSchema = z.object(shape).strict();
    let patchSchema;
    if (options.partial === false) {
        patchSchema = z.object(shape).strict();
    } else {
        patchSchema = z.object(shape).partial().strict();
    }
    const result = patchSchema.safeParse(body);
    if (!result.success) throw new APIError(400, firstIssueMessage(result.error));

    return result.data as Partial<TEntity>;
}
