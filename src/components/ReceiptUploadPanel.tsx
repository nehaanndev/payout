"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, UploadCloud } from "lucide-react";
import { Member } from "@/types/group";
import { CurrencyCode } from "@/lib/currency_core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export interface ReceiptPrefillData {
  description?: string;
  amount?: number;
  merchant?: string;
  rawText?: string;
  imageDataUrl?: string;
  paidBy?: string;
  splitMode?: "percentage" | "weight";
  splits?: Record<string, number>;
}

export interface ReceiptUploadPanelProps {
  members: Member[];
  currency: CurrencyCode;
  defaultPayerId?: string;
  onCancel: () => void;
  onPrefill: (data: ReceiptPrefillData) => void;
}

export default function ReceiptUploadPanel({
  members,
  currency,
  defaultPayerId,
  onCancel,
  onPrefill,
}: ReceiptUploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedPayer, setSelectedPayer] = useState<string | undefined>(defaultPayerId);
  const [splitEqually, setSplitEqually] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [rawImageDataUrl, setRawImageDataUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ocrText, setOcrText] = useState("");
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [parsedMerchant, setParsedMerchant] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const [scanDebug, setScanDebug] = useState("");

  useEffect(() => {
    if (!selectedPayer && defaultPayerId) {
      setSelectedPayer(defaultPayerId);
    }
  }, [defaultPayerId, selectedPayer]);

  const equalSplitPreview = useMemo(() => {
    if (!splitEqually || members.length === 0) {
      return null;
    }

    const equalPct = Number((100 / members.length).toFixed(4));
    return members.map((m) => ({
      id: m.id,
      name: m.firstName,
      percent: equalPct,
    }));
  }, [splitEqually, members]);

  const triggerInput = useCallback((input: HTMLInputElement | null) => {
    if (!input) return;
    // reset to allow re-selecting the same file
    input.value = "";
    input.click();
  }, []);

  const resetScanState = useCallback(() => {
    setIsScanning(false);
    setProgress(0);
    setOcrText("");
    setErrorMessage(null);
    setParsedMerchant(undefined);
    setHasScanned(false);
    setScanDebug("");
  }, []);

  const handleFileSelection = useCallback((file: File | null) => {
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setRawImageDataUrl(result);
    };
    reader.readAsDataURL(file);
    resetScanState();
  }, [resetScanState]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      handleFileSelection(file);
    },
    [handleFileSelection],
  );

  const handleScan = useCallback(async () => {
    if (!imageFile && !rawImageDataUrl) {
      setErrorMessage("Upload a receipt photo before scanning.");
      return;
    }

    setIsScanning(true);
    setProgress(0);
    setErrorMessage(null);

    try {
      const tesseract = await import("tesseract.js");
      const source = imageFile ?? rawImageDataUrl!;
      const { data } = await tesseract.recognize(source, "eng", {
        logger: (message) => {
          if (message.status === "recognizing text") {
            setProgress(message.progress ?? 0);
          }
        },
      });

      const text = data.text ?? "";
      setOcrText(text);
      setHasScanned(true);

      const { amount, merchant, debug } = extractReceiptInsights(text);
      setParsedMerchant(merchant);
      if (!description.trim() && merchant) {
        setDescription(merchant);
      }
      if (amount != null) {
        setTotalAmount(amount.toFixed(2));
      } else if (!totalAmount) {
        setTotalAmount("");
      }
      setScanDebug(debug);
    } catch (err) {
      console.error("Receipt scan failed", err);
      setErrorMessage("We couldn't scan that receipt. Try a clearer photo or re-upload.");
    } finally {
      setIsScanning(false);
    }
  }, [description, imageFile, rawImageDataUrl, totalAmount]);

  const canContinue = Boolean(selectedPayer && totalAmount && !Number.isNaN(Number(totalAmount)));

  const handleContinue = useCallback(() => {
    if (!selectedPayer) {
      setErrorMessage("Please choose who paid for this receipt.");
      return;
    }
    const parsedAmount = parseFloat(totalAmount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Enter a valid total amount before continuing.");
      return;
    }

    const payload: ReceiptPrefillData = {
      amount: parsedAmount,
      description: description.trim() || parsedMerchant || "Receipt",
      merchant: parsedMerchant,
      rawText: ocrText || undefined,
      imageDataUrl: rawImageDataUrl ?? undefined,
      paidBy: selectedPayer,
    };

    if (splitEqually && members.length > 0) {
      const equalPct = Number((100 / members.length).toFixed(4));
      const splits = members.reduce<Record<string, number>>((acc, member) => {
        acc[member.id] = equalPct;
        return acc;
      }, {});
      payload.splitMode = "percentage";
      payload.splits = splits;
    }

    onPrefill(payload);
  }, [
    description,
    members,
    ocrText,
    onPrefill,
    parsedMerchant,
    rawImageDataUrl,
    selectedPayer,
    splitEqually,
    totalAmount,
  ]);

  const detectedTextWithDebug = scanDebug ? `${ocrText}\n\n---\n${scanDebug}`.trim() : ocrText;

  return (
    <Card className="border-dashed border-2 border-blue-200 bg-white/80">
      <CardHeader>
        <CardTitle>Upload or Scan a Receipt</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={cameraInputRef}
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="h-24 flex flex-col items-center justify-center gap-2"
            onClick={() => triggerInput(fileInputRef.current)}
          >
            <UploadCloud className="h-6 w-6" />
            Choose from device
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-24 flex flex-col items-center justify-center gap-2"
            onClick={() => triggerInput(cameraInputRef.current)}
          >
            <Camera className="h-6 w-6" />
            Take a photo
          </Button>
        </div>

        {imagePreview && (
          <div className="rounded-lg border bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700 mb-3">Preview</p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Receipt preview"
                className="rounded-md border bg-white object-contain max-h-64 sm:max-w-xs"
              />
              <div className="flex-1 space-y-3">
                <Label htmlFor="description">Merchant / description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={parsedMerchant ?? "Optional merchant name"}
                />

                <div>
                  <Label htmlFor="totalAmount">Total amount ({currency})</Label>
                  <Input
                    id="totalAmount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="mt-1"
                    value={totalAmount}
                    onChange={(event) => setTotalAmount(event.target.value)}
                  />
                </div>

                <Button type="button" onClick={handleScan} disabled={isScanning} className="w-full sm:w-auto">
                  {isScanning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scanning… {Math.round(progress * 100)}%
                    </>
                  ) : (
                    "Scan receipt for details"
                  )}
                </Button>

                {hasScanned && ocrText && (
                  <div className="space-y-2">
                    <Label>Detected text</Label>
                    <textarea
                      value={detectedTextWithDebug}
                      readOnly
                      className="min-h-32 w-full rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-700"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Receipt scanning runs entirely in your browser using OCR. Try to align the receipt straight and ensure
          the totals are readable. Extracted totals are interpreted as {currency}.
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <Label>Who paid?</Label>
            <Select
              value={selectedPayer ?? ""}
              onValueChange={(value) => setSelectedPayer(value || undefined)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select payer" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.firstName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md bg-slate-100 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Split equally</p>
              <p className="text-xs text-slate-500">
                Everyone pays the same amount. Toggle off if you want to fine-tune splits after scanning.
              </p>
            </div>
            <Switch checked={splitEqually} onCheckedChange={setSplitEqually} />
          </div>

          {splitEqually && equalSplitPreview && (
            <div className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <p className="mb-2 font-medium text-slate-700">Preview of equal split</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {equalSplitPreview.map((entry) => (
                  <li key={entry.id} className="flex justify-between">
                    <span>{entry.name}</span>
                    <span>{entry.percent.toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel}>
            Back
          </Button>
          <Button
            onClick={handleContinue}
            disabled={!canContinue || isScanning || !imagePreview}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Use These Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type CandidateType = "grandTotal" | "total" | "amount" | "subtotal" | "tax" | "other";

interface Candidate {
  value: number;
  priority: number;
  lineIndex: number;
  line: string;
  type: CandidateType;
}

function extractReceiptInsights(text: string): {
  amount: number | undefined;
  merchant: string | undefined;
  debug: string;
} {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const merchant = lines[0]?.replace(/[^A-Za-z0-9 &'./-]+/g, " ").trim() || undefined;

  const numberRegex = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2})/g;

  const candidates: Candidate[] = [];

  lines.forEach((line, index) => {
    const matches = Array.from(line.matchAll(numberRegex));
    if (matches.length === 0) return;
    const token = matches[matches.length - 1][0];
    const parsed = normalizeNumber(token);
    if (parsed == null) return;

    const type = classifyLine(line);
    const priority = computePriority(type);

    candidates.push({
      value: parsed,
      priority,
      lineIndex: index,
      line,
      type,
    });
  });

  let amount: number | undefined;
  let debug = "No numeric matches found.";

  if (candidates.length > 0) {
    const sortedByValue = [...candidates].sort((a, b) => {
      if (b.value !== a.value) {
        return b.value - a.value;
      }
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.lineIndex - a.lineIndex;
    });

    const valuePreferred = sortedByValue.find((candidate) => candidate.priority >= 3);

    const sortedByPriority = [...candidates].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      if (b.value !== a.value) {
        return b.value - a.value;
      }
      return b.lineIndex - a.lineIndex;
    });

    const priorityPreferred = sortedByPriority[0];

    const fallbackHighest = sortedByValue[0];

    if (valuePreferred) {
      amount = valuePreferred.value;
    } else if (priorityPreferred) {
      amount = priorityPreferred.value;
    } else if (fallbackHighest) {
      amount = fallbackHighest.value;
    }

    debug = candidates
      .map((candidate) => `line ${candidate.lineIndex + 1}: ${candidate.line} => ${candidate.value.toFixed(2)} [${candidate.type} | priority ${candidate.priority}]`)
      .join("\n");

    if (amount != null) {
      const chosen =
        (valuePreferred && valuePreferred.value === amount && valuePreferred.priority >= 3 && valuePreferred) ||
        (priorityPreferred && priorityPreferred.value === amount && priorityPreferred) ||
        fallbackHighest;
      if (chosen) {
        debug += `\n\nChosen: line ${chosen.lineIndex + 1} (${chosen.type}) value ${chosen.value.toFixed(2)} priority ${chosen.priority}`;
      }
    }
  }

  if (amount == null) {
    let highest = 0;
    for (const line of lines) {
      const matches = line.match(numberRegex);
      if (!matches) continue;
      for (const raw of matches) {
        const value = normalizeNumber(raw);
        if (value != null && value > highest) {
          highest = value;
        }
      }
    }
    amount = highest > 0 ? highest : undefined;
  }

  if (candidates.length === 0 && amount != null) {
    debug = `Fallback to highest numeric value detected: ${amount.toFixed(2)}`;
  }

  return { amount, merchant, debug };
}

function classifyLine(line: string): CandidateType {
  const normalized = line.toLowerCase();
  if (/(grand\s+total|amount\s+due|balance\s+due|total\s+due|total\s+amount|amount\s+payable|please\s+pay|total\s+to\s+pay|total\s+bill|pay\s+this)/i.test(normalized)) {
    return "grandTotal";
  }
  if (/(subtotal|sub\s*total)/i.test(normalized)) {
    return "subtotal";
  }
  if (/(tax|vat|gst|hst|pst|service|delivery|tip|gratuity|fee)/i.test(normalized)) {
    return "tax";
  }
  if (/total/i.test(normalized)) {
    return "total";
  }
  if (/(amount|payment|payable)/i.test(normalized)) {
    return "amount";
  }
  return "other";
}

function computePriority(type: CandidateType): number {
  switch (type) {
    case "grandTotal":
      return 5;
    case "total":
      return 4;
    case "amount":
      return 3;
    case "subtotal":
      return 2;
    case "other":
      return 2;
    case "tax":
      return 1;
    default:
      return 0;
  }
}

function normalizeNumber(input: string): number | undefined {
  const cleaned = input.replace(/[^0-9.,]/g, "");
  if (!cleaned) return undefined;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      const normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
      return Number.parseFloat(normalized);
    }
    const normalized = cleaned.replace(/,/g, "");
    return Number.parseFloat(normalized);
  }

  if (lastComma > -1) {
    const normalized = cleaned.replace(/,/g, ".");
    return Number.parseFloat(normalized);
  }

  return Number.parseFloat(cleaned);
}
