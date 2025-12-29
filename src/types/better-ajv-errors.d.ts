declare module 'better-ajv-errors' {
    import { ErrorObject } from 'ajv';

    interface Options {
        format?: 'cli' | 'js';
        indent?: number;
    }

    function betterAjvErrors(
        schema: object,
        data: unknown,
        errors: ErrorObject[] | null | undefined,
        options?: Options
    ): string | object[];

    export = betterAjvErrors;
}
