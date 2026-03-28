import test from "node:test";
import assert from "node:assert/strict";

import { parseFeishuMessageEvent } from "../src/feishu/feishu-message-parser.js";

test("parseFeishuMessageEvent returns normalized text message", () => {
  const result = parseFeishuMessageEvent({
    sender: {
      sender_type: "user",
      sender_id: {
        open_id: "ou_123",
      },
    },
    message: {
      message_id: "om_123",
      chat_id: "oc_123",
      chat_type: "p2p",
      message_type: "text",
      content: JSON.stringify({ text: "hello" }),
      mentions: [
        {
          id: {
            open_id: "ou_bot",
          },
        },
      ],
    },
  });

  assert.deepEqual(result, {
    channel: "feishu",
    conversationId: "oc_123",
    messageId: "om_123",
    parentMessageId: undefined,
    senderId: "ou_123",
    senderType: "user",
    chatType: "p2p",
    messageType: "text",
    text: "hello",
    imageKeys: [],
    mentions: ["ou_bot"],
    rawEvent: {
      sender: {
        sender_type: "user",
        sender_id: {
          open_id: "ou_123",
        },
      },
      message: {
        message_id: "om_123",
        chat_id: "oc_123",
        chat_type: "p2p",
        message_type: "text",
        content: "{\"text\":\"hello\"}",
        mentions: [
          {
            id: {
              open_id: "ou_bot",
            },
          },
        ],
      },
    },
  });
});

test("parseFeishuMessageEvent ignores non-user events", () => {
  assert.equal(
    parseFeishuMessageEvent({
      sender: {
        sender_type: "app",
      },
      message: {
        message_id: "om_1",
        chat_id: "oc_1",
        chat_type: "p2p",
        message_type: "text",
        content: JSON.stringify({ text: "ignored" }),
      },
    }),
    null,
  );
});

test("parseFeishuMessageEvent returns normalized image message", () => {
  const result = parseFeishuMessageEvent({
    sender: {
      sender_type: "user",
      sender_id: {
        open_id: "ou_1",
      },
    },
    message: {
        message_id: "om_1",
        chat_id: "oc_1",
        chat_type: "p2p",
        message_type: "image",
        content: JSON.stringify({ image_key: "img_1" }),
    },
  });

  assert.deepEqual(result, {
    channel: "feishu",
    conversationId: "oc_1",
    messageId: "om_1",
    parentMessageId: undefined,
    senderId: "ou_1",
    senderType: "user",
    chatType: "p2p",
    messageType: "image",
    text: "",
    imageKeys: ["img_1"],
    mentions: [],
    rawEvent: {
      sender: {
        sender_type: "user",
        sender_id: {
          open_id: "ou_1",
        },
      },
      message: {
        message_id: "om_1",
        chat_id: "oc_1",
        chat_type: "p2p",
        message_type: "image",
        content: "{\"image_key\":\"img_1\"}",
      },
    },
  });
});

test("parseFeishuMessageEvent returns normalized post message with text and image", () => {
  const result = parseFeishuMessageEvent({
    sender: {
      sender_type: "user",
      sender_id: {
        open_id: "ou_post",
      },
    },
    message: {
      message_id: "om_post_1",
      chat_id: "oc_post_1",
      chat_type: "p2p",
      message_type: "post",
      content: JSON.stringify({
        zh_cn: {
          title: "",
          content: [
            [
              { tag: "text", text: "what is this" },
              { tag: "img", image_key: "img_post_1" },
            ],
          ],
        },
      }),
    },
  });

  assert.deepEqual(result, {
    channel: "feishu",
    conversationId: "oc_post_1",
    messageId: "om_post_1",
    parentMessageId: undefined,
    senderId: "ou_post",
    senderType: "user",
    chatType: "p2p",
    messageType: "post",
    text: "what is this",
    imageKeys: ["img_post_1"],
    mentions: [],
    rawEvent: {
      sender: {
        sender_type: "user",
        sender_id: {
          open_id: "ou_post",
        },
      },
      message: {
        message_id: "om_post_1",
        chat_id: "oc_post_1",
        chat_type: "p2p",
        message_type: "post",
        content:
          "{\"zh_cn\":{\"title\":\"\",\"content\":[[{\"tag\":\"text\",\"text\":\"what is this\"},{\"tag\":\"img\",\"image_key\":\"img_post_1\"}]]}}",
      },
    },
  });
});
