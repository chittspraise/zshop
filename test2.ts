import { Database } from './src/types/database.types';
import { SupabaseClient } from '@supabase/supabase-js';

type PublicSchema = Database['public'];

// The actual schema check from supabase-js
type GenericSchema = import('@supabase/supabase-js/dist/module/lib/types').GenericSchema;

type TestCompatibility = PublicSchema extends GenericSchema ? true : false;

const isCompatible: TestCompatibility = true;
