/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '@hookform/resolvers/yup' {
    import { Resolver } from 'react-hook-form';
    import { AnyObjectSchema } from 'yup';

    export function yupResolver<T extends AnyObjectSchema>(
        schema: T,
        schemaOptions?: object,
        resolverOptions?: object,
    ): Resolver<any>;
}
