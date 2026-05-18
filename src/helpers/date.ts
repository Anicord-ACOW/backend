import {APIError} from "@/helpers/api-error";

export function throwIfAfter(date: Date, error: string) {
    if (new Date() > date) throw new APIError(400, error);
}

export function throwIfBefore(date: Date, error: string) {
    if (new Date() < date) throw new APIError(400, error);
}