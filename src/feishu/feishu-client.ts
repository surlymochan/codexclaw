import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Client, EventDispatcher, WSClient } from "@larksuiteoapi/node-sdk";

import type { Logger } from "../core/logger.js";
import type {
  ImageInputAsset,
  NormalizedChannelMessage,
  PendingImageMessage,
  QuotedMessageContext,
} from "../types/channel.js";
import {
  buildInteractiveMarkdownCard,
  extractMessageText,
} from "./feishu-message-content.js";
import { parseFeishuMessageEvent, type FeishuMessageEvent } from "./feishu-message-parser.js";

export interface FeishuClientOptions {
  appId: string;
  appSecret: string;
  encryptKey?: string;
  verificationToken?: string;
}

export class FeishuClient {
  private readonly client: Client;
  private readonly wsClient: WSClient;

  constructor(
    private readonly options: FeishuClientOptions,
    private readonly log: Logger,
  ) {
    this.client = new Client({
      appId: options.appId,
      appSecret: options.appSecret,
    });

    this.wsClient = new WSClient({
      appId: options.appId,
      appSecret: options.appSecret,
    });
  }

  async start(onMessage: (message: NormalizedChannelMessage) => Promise<void>): Promise<void> {
    const dispatcher = new EventDispatcher({
      encryptKey: this.options.encryptKey,
      verificationToken: this.options.verificationToken,
    });

    dispatcher.register({
      "im.message.receive_v1": async (event: FeishuMessageEvent) => {
        const message = parseFeishuMessageEvent(event);
        if (!message) {
          return;
        }

        this.log.info("received feishu message", {
          conversationId: message.conversationId,
          messageId: message.messageId,
        });
        await onMessage(message);
      },
    });

    await this.wsClient.start({
      eventDispatcher: dispatcher,
    });

    this.log.info("feishu websocket client started");
  }

  async selfCheck(): Promise<{ ok: boolean; code?: number; msg?: string }> {
    const response = await this.client.auth.v3.tenantAccessToken.internal({
      data: {
        app_id: this.options.appId,
        app_secret: this.options.appSecret,
      },
    });

    return {
      ok: (response.code ?? 0) === 0,
      code: response.code,
      msg: response.msg,
    };
  }

  async sendMarkdown(chatId: string, markdown: string): Promise<void> {
    const response = await this.client.im.v1.message.create({
      params: {
        receive_id_type: "chat_id",
      },
      data: {
        receive_id: chatId,
        msg_type: "interactive",
        content: buildInteractiveMarkdownCard(markdown),
      },
    });

    if (response.code && response.code !== 0) {
      throw new Error(`Feishu send failed: ${response.code} ${response.msg ?? "unknown error"}`);
    }
  }

  async sendText(chatId: string, text: string): Promise<void> {
    const response = await this.client.im.v1.message.create({
      params: {
        receive_id_type: "chat_id",
      },
      data: {
        receive_id: chatId,
        msg_type: "text",
        content: JSON.stringify({ text }),
      },
    });

    if (response.code && response.code !== 0) {
      throw new Error(`Feishu send failed: ${response.code} ${response.msg ?? "unknown error"}`);
    }
  }

  async getQuotedMessage(messageId: string): Promise<QuotedMessageContext | null> {
    const response = await this.client.im.v1.message.get({
      path: {
        message_id: messageId,
      },
    });

    if ((response.code ?? 0) !== 0) {
      throw new Error(`Feishu message get failed: ${response.code ?? "unknown"} ${response.msg ?? ""}`);
    }

    const item = response.data?.items?.[0];
    if (!item) {
      return null;
    }

    return {
      messageId,
      msgType: item.msg_type,
      senderId: item.sender?.id,
      text:
        extractMessageText(item.msg_type, item.body?.content) ||
        (item.msg_type === "image" ? "[quoted image]" : ""),
    };
  }

  async downloadMessageImages(
    messages: Array<Pick<NormalizedChannelMessage, "messageId" | "imageKeys"> | PendingImageMessage>,
  ): Promise<ImageInputAsset[]> {
    const assets: ImageInputAsset[] = [];
    for (const message of messages) {
      for (const imageKey of message.imageKeys) {
        const tempPath = path.join(
          os.tmpdir(),
          `codex-channel-${message.messageId}-${imageKey}.png`,
        );
        this.log.info("downloading feishu image", {
          messageId: message.messageId,
          imageKey,
        });
        const resource = await this.client.im.v1.messageResource.get({
          path: {
            message_id: message.messageId,
            file_key: imageKey,
          },
          params: {
            type: "image",
          },
        });

        await resource.writeFile(tempPath);
        assets.push({
          path: tempPath,
          mimeType: "image/png",
        });
      }
    }

    return assets;
  }

  async sendImageByKey(chatId: string, imageKey: string): Promise<void> {
    const response = await this.client.im.v1.message.create({
      params: {
        receive_id_type: "chat_id",
      },
      data: {
        receive_id: chatId,
        msg_type: "image",
        content: JSON.stringify({ image_key: imageKey }),
      },
    });

    if (response.code && response.code !== 0) {
      throw new Error(`Feishu send image failed: ${response.code} ${response.msg ?? "unknown error"}`);
    }
  }

  async uploadImageFromPath(filePath: string): Promise<string> {
    const uploaded = await this.client.im.v1.image.create({
      data: {
        image_type: "message",
        image: fs.createReadStream(filePath),
      },
    });

    const imageKey = uploaded?.image_key;
    if (!imageKey) {
      throw new Error("Feishu image upload returned no image_key");
    }

    return imageKey;
  }

  async uploadImageFromUrl(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Image download failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uploaded = await this.client.im.v1.image.create({
      data: {
        image_type: "message",
        image: Buffer.from(arrayBuffer),
      },
    });

    const imageKey = uploaded?.image_key;
    if (!imageKey) {
      throw new Error("Feishu image upload returned no image_key");
    }

    return imageKey;
  }

  async addReaction(messageId: string, emojiType: string): Promise<string> {
    const response = await this.client.im.v1.messageReaction.create({
      path: {
        message_id: messageId,
      },
      data: {
        reaction_type: {
          emoji_type: emojiType,
        },
      },
    });

    if (response.code && response.code !== 0) {
      throw new Error(
        `Feishu add reaction failed: ${response.code} ${response.msg ?? "unknown error"}`,
      );
    }

    const reactionId = response.data?.reaction_id;
    if (!reactionId) {
      throw new Error("Feishu add reaction returned no reaction_id");
    }

    return reactionId;
  }

  async removeReaction(messageId: string, reactionId: string): Promise<void> {
    const response = await this.client.im.v1.messageReaction.delete({
      path: {
        message_id: messageId,
        reaction_id: reactionId,
      },
    });

    if (response.code && response.code !== 0) {
      throw new Error(
        `Feishu remove reaction failed: ${response.code} ${response.msg ?? "unknown error"}`,
      );
    }
  }
}
