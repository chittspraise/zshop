import { Database } from './src/types/database.types';

// Let's reproduce the exact type check Supabase does
import { PostgrestClient } from '@supabase/postgrest-js';
// We don't need to import GenericSchema, we can just extract it
type GenericSchema = Parameters<PostgrestClient<any, any>['from']>[0] extends keyof any ? any : never; // wait, no.

type ExtractGenericSchema<T> = T extends PostgrestClient<any, infer S> ? S : never;
// Actually, I can just use conditional types to find out.

type Schema = Database['public'];

type GenericTable = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
  Relationships: {
    foreignKeyName: string
    columns: string[]
    isOneToOne?: boolean
    referencedRelation: string
    referencedColumns: string[]
  }[]
}

type GenericView = {
  Row: Record<string, unknown>
  Relationships: {
    foreignKeyName: string
    columns: string[]
    isOneToOne?: boolean
    referencedRelation: string
    referencedColumns: string[]
  }[]
}

type GenericFunction = {
  Args: Record<string, unknown>
  Returns: unknown
}

type ExpectedSchema = {
  Tables: Record<string, GenericTable>
  Views: Record<string, GenericView>
  Functions: Record<string, GenericFunction>
  Enums: Record<string, string[]>
  CompositeTypes: Record<string, Record<string, unknown>>
}

export type TestTables = Schema['Tables'] extends ExpectedSchema['Tables'] ? true : false;
export type TestViews = Schema['Views'] extends ExpectedSchema['Views'] ? true : false;
export type TestFunctions = Schema['Functions'] extends ExpectedSchema['Functions'] ? true : false;
export type TestEnums = Schema['Enums'] extends ExpectedSchema['Enums'] ? true : false;
export type TestCompositeTypes = Schema['CompositeTypes'] extends ExpectedSchema['CompositeTypes'] ? true : false;

export type TestAll = Schema extends ExpectedSchema ? true : false;

const tables: TestTables = true;
const views: TestViews = true;
const functions: TestFunctions = true;
const enums: TestEnums = true;
const composite: TestCompositeTypes = true;
const all: TestAll = true;
