import { TransformFnParams } from 'class-transformer';

// For @Transform(trim): trims strings, leaves anything else for the validators to reject.
export const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;
