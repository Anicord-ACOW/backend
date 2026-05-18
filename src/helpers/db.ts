import {EntityManager, EntityName, FilterQuery, Loaded, MikroORM} from "@mikro-orm/core";

import config from "@/mikro-orm.config";

const orm = new MikroORM(config);

export function getEntityManager() {
    return orm.em.fork();
}

export async function closeDatabase() {
    await orm.close(true);
}

export async function findOneOrCreate<
    Entity extends object,
>(
    em: EntityManager,
    entityName: EntityName<Entity>,
    where: Partial<Entity>,
) {
    const result = await em.findOne(entityName, where);
    if (result === null) {
        // @ts-ignore im done dealing with this just let the db reject it
        const obj = em.create(entityName, where as Entity, {partial: true});
        em.persist(obj);
        return obj;
    }
    return result;
}
