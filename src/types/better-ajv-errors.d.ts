declare module 'better-ajv-errors' {
    interface AjvErrorObject {
        keyword: string;
        instancePath: string;
        schemaPath: string;
        params: Record<string, unknown>;
        message?: string;
    }

    interface Options {
        format?: 'cli' | 'js';
        indent?: number;
    }

    function betterAjvErrors(
        schema: object,
        data: unknown,
        errors: AjvErrorObject[] | null | undefined,
        options?: Options
    ): string | object[];

    export default betterAjvErrors;
}
