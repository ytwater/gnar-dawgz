module.exports = {
	conversationApi: {
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
	eventsApi: {
		output: {
			mode: "single", //  "tags",
			target: "app/lib/twilio/events-api.ts",
			schemas: "app/lib/twilio/models",
			client: "react-query",
			baseUrl: "https://events.twilio.com",
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
				"https://raw.githubusercontent.com/twilio/twilio-oai/refs/heads/main/spec/json/twilio_events_v1.json",
		},
	},
	accountsApi: {
		output: {
			mode: "single", //  "tags",
			target: "app/lib/twilio/accounts-api.ts",
			schemas: "app/lib/twilio/models",
			client: "react-query",
			baseUrl: "https://api.twilio.com",
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
				"https://raw.githubusercontent.com/twilio/twilio-oai/refs/heads/main/spec/json/twilio_accounts_v1.json",
		},
	},
	messagingApi: {
		output: {
			mode: "single", //  "tags",
			target: "app/lib/twilio/messaging-api.ts",
			schemas: "app/lib/twilio/models",
			client: "react-query",
			baseUrl: "https://messaging.twilio.com",
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
				"https://raw.githubusercontent.com/twilio/twilio-oai/refs/heads/main/spec/json/twilio_messaging_v1.json",
		},
	},
};
