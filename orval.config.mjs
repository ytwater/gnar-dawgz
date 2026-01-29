import { defineConfig } from "orval";

console.log(
	"process.env.WAHA_SWAGGER_PASSWORD",
	process.env.WAHA_SWAGGER_PASSWORD,
);
console.log(
	"Buffer",
	Buffer.from(`admin:${process.env.WAHA_SWAGGER_PASSWORD ?? ""}`).toString(
		"base64",
	),
);
console.log("btoa", btoa(`admin:${process.env.WAHA_SWAGGER_PASSWORD ?? ""}`));

console.log(
	"atob",
	atob(
		Buffer.from(`admin:${process.env.WAHA_SWAGGER_PASSWORD ?? ""}`).toString(
			"base64",
		),
	),
);

console.log(
	"atob Postman",
	atob("YWRtaW46MzY4ZTQxZjQ5MTU0NGY3ZGE5YjAxNTFiNmZmOGViNGY="),
);

export default defineConfig({
	wahaApi: {
		output: {
			mode: "single", //  "tags",
			target: "app/lib/whatsapp/whatsapp-api.ts",
			schemas: "app/lib/whatsapp/models",
			client: "react-query",
			baseUrl: "https://waha.gnardawgs.surf",
			httpClient: "fetch",
			indexFiles: true,
			override: {
				operations: {},
			},
		},
		input: {
			// target: "https://waha.gnardawgs.surf/-json",
			target: "./waha.gnardawgs.swagger.json",
			headers: {
				Authorization: `Basic ${Buffer.from(
					`admin:${(process.env.WAHA_SWAGGER_PASSWORD ?? "").trim()}`,
					"utf8",
				).toString("base64")}`,
			},
		},
		hooks: {
			afterAllFilesWrite: "npx biome format --write",
		},
	},
	conversationApi: {
		output: {
			mode: "single", //  "tags",
			target: "app/lib/twilio/conversation-api.ts",
			schemas: "app/lib/twilio/models",
			client: "react-query",
			baseUrl: "https://conversations.twilio.com",
			httpClient: "fetch",
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
	// swellcloudApi: {
	// 	output: {
	// 		mode: "single", //  "tags",
	// 		target: "app/lib/swellcloud/swellcloud-api.ts",
	// 		schemas: "app/lib/swellcloud/models",
	// 		client: "react-query",
	// 		baseUrl: "https://api.swellcloud.net",
	// 		httpClient: "fetch",
	// 		indexFiles: true,
	// 		override: {
	// 			operations: {
	// 				// Orval treats POST operations as mutations by default, so we need to override it to useQuery
	// 				// PostApiPublicGetAgencyList: {
	// 				//   query: {
	// 				//     useQuery: true,
	// 				//   },
	// 				// },
	// 				// PostApiPublicGetPickLists: {
	// 				//   query: {
	// 				//     useQuery: true,
	// 				//   },
	// 				// },
	// 			},
	// 		},
	// 	},
	// 	input: {
	// 		target: "https://api.swellcloud.net/openapi.json",
	// 	},
	// },
});
