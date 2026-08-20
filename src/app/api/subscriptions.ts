import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

export const useOrderUpdateSubscription = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [
          { data: orders, error: ordersError },
          { data: profiles, error: profilesError },
          { data: products, error: productsError },
        ] = await Promise.all([
          supabase.from("order").select("*"),
          supabase.from("profile").select("*"),
          supabase.from("product").select("*"),
        ]);

        if (ordersError) {
          console.error("Error fetching orders:", ordersError);
        } else {
          queryClient.setQueryData(["orders"], orders);
        }

        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
        } else {
          queryClient.setQueryData(["my-profile"], profiles);
        }

        if (productsError) {
          console.error("Error fetching products:", productsError);
        } else {
          queryClient.setQueryData(["products"], products);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchInitialData();

    const subscription = supabase
      .channel("custom-update-channel")
      // Orders
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order" },
        (payload) => {
          console.log("New order inserted!", payload);
          queryClient.invalidateQueries({ queryKey: ["orders"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "order" },
        (payload) => {
          console.log("Order updated!", payload);
          queryClient.invalidateQueries({ queryKey: ["orders"] });
        }
      )
      // Profiles
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profile" },
        (payload) => {
          console.log("New profile inserted!", payload);
          queryClient.invalidateQueries({ queryKey: ["my-profile"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profile" },
        (payload) => {
          console.log("Profile updated!", payload);
          queryClient.invalidateQueries({ queryKey: ["my-profile"] });
        }
      )
      // Products
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "product" },
        (payload) => {
          console.log("New product inserted!", payload);
          queryClient.invalidateQueries({ queryKey: ["products"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "product" },
        (payload) => {
          console.log("Product updated!", payload);
          queryClient.invalidateQueries({ queryKey: ["products"] });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);
};
