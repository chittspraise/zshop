import { Database } from './src/types/database.types';
import { GenericSchema } from '@supabase/postgrest-js';

type PublicSchema = Database['public'];

type TestCompatibility = PublicSchema extends GenericSchema ? true : false;
const isCompatible: TestCompatibility = true;
