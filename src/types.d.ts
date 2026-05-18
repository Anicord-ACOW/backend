import {EntityManager} from "@mikro-orm/core";
import {User} from "@/helpers/models/user";

declare global {
  namespace Express {
    interface Request {
      auth?: User;
      em: EntityManager;
    }
  }
}

export {};
