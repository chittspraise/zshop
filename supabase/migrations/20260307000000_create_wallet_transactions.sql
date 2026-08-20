-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS "public"."wallet_transactions" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "user_id" uuid NOT NULL,
    "amount" double precision NOT NULL,
    "type" text NOT NULL,
    "description" text NOT NULL,
    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- Enable RLS
ALTER TABLE "public"."wallet_transactions" ENABLE ROW LEVEL SECURITY;

-- Enable SELECT for users to read their own transactions
CREATE POLICY "Allow select for users to read their own transactions" 
ON "public"."wallet_transactions" 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Enable INSERT for authenticated users to create transactions
CREATE POLICY "Allow insert for authenticated users" 
ON "public"."wallet_transactions" 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);
