

We want to simulate a group chat using WhatsApp numbers.  Since Twilio numbers cannot be added to standard group chats, we will simulate it by having each user talk 1-on-1 to our Twilio number.

Each one on one conversation will have it's own conversation id.  We will receive a "onConversationAdded" webhook.

When a message is added we will receive a "onMessageAdded".  We can replay this message (prefixed with the sender) to each of the individual conversations.




