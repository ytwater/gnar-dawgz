module.exports = {
	api: {
		output: {
			mode: "single", //  "tags",
			target: "app/lib/twilio/conversation-api.ts",
			schemas: "app/lib/twilio/models",
			client: "react-query",
			baseUrl: "https://conversations.twilio.com",
			httpClient: "fetch",
			prettier: true,
			indexFiles: true,
			override: {
				operations: {
					// Orval treats POST operations as mutations by default, so we need to override it to useQuery
					// PostApiPublicGetAgencyList: {
					//   query: {
					//     useQuery: true,
					//   },
					// },
					// PostApiPublicGetPickLists: {
					//   query: {
					//     useQuery: true,
					//   },
					// },
				},
			},
		},
		input: {
			target:
				"https://raw.githubusercontent.com/twilio/twilio-oai/refs/heads/main/spec/json/twilio_conversations_v1.json",
		},
	},
};
