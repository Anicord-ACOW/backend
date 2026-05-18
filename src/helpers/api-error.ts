export class APIError extends Error {
    readonly status: number;
    readonly message: string;

    constructor(status: number, message?: string) {
        super(`Error ${status} ${message}`);
        this.status = status;
        this.message = message ?? "";
    }
}