import 'dotenv/config';

export default {
  expo: {
    name: "eshop",
    slug: "eshop",
    scheme: "eshop",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/Image_Editor.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.chitts.eshop",
      associatedDomains: [
        "applinks:eshop"
      ],
      config: {
        googleMapsApiKey: process.env.GOOGLE_API_KEY
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/Image_Editor.png",
        backgroundColor: "#ffffff"
      },
      package: "com.chitts.eshop",
      intentFilters: [
        {
          action: "VIEW",
          data: [
            {
              scheme: "eshop"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        },
        {
          action: "VIEW",
          data: [
            {
              scheme: "whatsapp"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        }
      ],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_API_KEY
        }
      }
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-dev-client"
    ],
    extra: {
      googleApiKey: process.env.GOOGLE_API_KEY,
      router: {
        origin: false
      },
      eas: {
        projectId: "9cd85579-0db3-4a1e-9098-966e397d0cb4"
      }
    }
  }
};
