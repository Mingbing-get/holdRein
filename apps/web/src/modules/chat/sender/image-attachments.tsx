import { CloudUploadOutlined, PictureOutlined } from "@ant-design/icons";
import { Attachments } from "@ant-design/x";
import type { AttachmentsProps } from "@ant-design/x";
import { Badge, Button } from "antd";

import type { ImageContent } from "../../agent-messages/agent-message-types";

type AttachmentItem = NonNullable<AttachmentsProps["items"]>[number];
type AttachmentChangeInfo = Parameters<
  NonNullable<AttachmentsProps["onChange"]>
>[0];

export type SenderImageAttachmentItem = AttachmentItem & {
  imageContent?: ImageContent;
};

interface SenderImageAttachmentHeaderProps {
  getDropContainer: () => HTMLElement | null | undefined;
  items: SenderImageAttachmentItem[];
  onItemsChange: (items: SenderImageAttachmentItem[]) => void;
}

interface SenderImageAttachmentButtonProps {
  disabled?: boolean;
  hasItems: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SenderImageAttachmentHeader({
  getDropContainer,
  items,
  onItemsChange
}: SenderImageAttachmentHeaderProps) {
  return (
    <Attachments
      accept="image/*"
      beforeUpload={() => false}
      getDropContainer={getDropContainer}
      items={items}
      styles={{
        list: {
          background: "transparent"
        },
        placeholder: {
          background: "transparent"
        },
        upload: {
          background: "transparent"
        }
      }}
      style={{
        background: "transparent"
      }}
      placeholder={(type) =>
        type === "drop"
          ? { title: "拖放图片到这里" }
          : {
              description: "点击或拖放图片到这里",
              icon: <CloudUploadOutlined />,
              title: "上传图片"
            }
      }
      onChange={(info) => {
        void readImageAttachments(info, items).then(onItemsChange);
      }}
    />
  );
}

export function SenderImageAttachmentButton({
  disabled = false,
  hasItems,
  open,
  onOpenChange
}: SenderImageAttachmentButtonProps) {
  return (
    <Badge dot={hasItems && !open}>
      <Button
        aria-label="图片附件"
        disabled={disabled}
        icon={<PictureOutlined />}
        size="small"
        type="text"
        onClick={() => {
          onOpenChange(!open);
        }}
      />
    </Badge>
  );
}

export function getImageContents(
  items: SenderImageAttachmentItem[]
): ImageContent[] {
  return items
    .map((item) => item.imageContent)
    .filter((image): image is ImageContent => image !== undefined);
}

async function readImageAttachments(
  { fileList }: AttachmentChangeInfo,
  currentItems: SenderImageAttachmentItem[]
): Promise<SenderImageAttachmentItem[]> {
  const currentByUid = new Map(
    currentItems.map((item) => [item.uid, item])
  );
  const imageItems = fileList.filter(isImageAttachment);

  return Promise.all(
    imageItems.map(async (item) => {
      const currentItem = currentByUid.get(item.uid);

      if (currentItem?.imageContent) {
        return currentItem;
      }

      if (!item.originFileObj) {
        return item;
      }

      const dataUrl = await readFileAsDataUrl(item.originFileObj);
      const data = dataUrl.split(",", 2)[1] ?? "";

      return {
        ...item,
        cardType: "image",
        imageContent: {
          data,
          mimeType: item.originFileObj.type,
          type: "image"
        },
        status: "done",
        thumbUrl: dataUrl,
        url: dataUrl
      };
    })
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(
      reader.error ?? new Error("Failed to read image")
    );
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function isImageAttachment(item: AttachmentItem): boolean {
  if (item.originFileObj) {
    return item.originFileObj.type.startsWith("image/");
  }

  return typeof item.type === "string" && item.type.startsWith("image/");
}
