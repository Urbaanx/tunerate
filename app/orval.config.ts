export default {
  api: {
    output: {
      mode: "split",
      target: "./src/api/endpoints",
      client: "react-query",
      httpClient: "axios",
      override: {
        mutator: {
          path: "./src/api/axiosInstance.ts",
          name: "axiosInstance",
        },
        query: {
          useInfinite: false,
          useQuery: true,
        },
      },
    },
    input: "./swagger.json",
  },
};