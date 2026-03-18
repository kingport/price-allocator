"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";

interface AllocationResult {
  price: number;
  quantity: number;
  subtotal: number;
}

export default function Home() {
  const [prices, setPrices] = useState<number[]>([]);
  const [selectedPrices, setSelectedPrices] = useState<Set<number>>(new Set());
  const [newPrice, setNewPrice] = useState("");
  const [totalAmount, setTotalAmount] = useState("1000");
  const [integerOnly, setIntegerOnly] = useState(true);
  const [minQty, setMinQty] = useState("1");
  const [maxQty, setMaxQty] = useState("");
  const [rowCount, setRowCount] = useState("");
  const [results, setResults] = useState<AllocationResult[] | null>(null);
  const [error, setError] = useState("");

  const addPrice = useCallback(() => {
    const value = parseFloat(newPrice);
    if (isNaN(value) || value <= 0) {
      setError("请输入有效的正数单价");
      return;
    }
    if (prices.includes(value)) {
      setError("该单价已存在");
      return;
    }
    setPrices((prev) => [...prev, value]);
    setNewPrice("");
    setError("");
  }, [newPrice, prices]);

  const removePrice = useCallback((price: number) => {
    setPrices((prev) => prev.filter((p) => p !== price));
    setSelectedPrices((prev) => {
      const next = new Set(prev);
      next.delete(price);
      return next;
    });
    setResults(null);
  }, []);

  const toggleSelect = useCallback((price: number) => {
    setSelectedPrices((prev) => {
      const next = new Set(prev);
      if (next.has(price)) {
        next.delete(price);
      } else {
        next.add(price);
      }
      return next;
    });
    setResults(null);
  }, []);

  const selectAll = useCallback(() => {
    setSelectedPrices(new Set(prices));
    setResults(null);
  }, [prices]);

  const deselectAll = useCallback(() => {
    setSelectedPrices(new Set());
    setResults(null);
  }, []);

  const calculate = useCallback(() => {
    const total = parseFloat(totalAmount);
    if (isNaN(total) || total <= 0) {
      setError("请输入有效的总额");
      return;
    }

    const selected = prices.filter((p) => selectedPrices.has(p));
    if (selected.length === 0) {
      setError("请至少选择一个单价");
      return;
    }

    // Build row list: cycle through selected prices to fill rowCount
    const rows = rowCount ? parseInt(rowCount, 10) : selected.length;
    if (isNaN(rows) || rows < 1) {
      setError("生成条数必须为正整数");
      return;
    }
    if (rows < selected.length) {
      setError(`生成条数不能少于已选单价数（${selected.length}）`);
      return;
    }
    const rowPrices: number[] = [];
    for (let i = 0; i < rows; i++) {
      rowPrices.push(selected[i % selected.length]);
    }

    const qtyMin = minQty ? parseFloat(minQty) : 0;
    const qtyMax = maxQty ? parseFloat(maxQty) : Infinity;

    if (qtyMin < 0) {
      setError("最小数量不能为负数");
      return;
    }
    if (qtyMax !== Infinity && qtyMax < qtyMin) {
      setError("最大数量不能小于最小数量");
      return;
    }
    if (integerOnly && qtyMin !== Math.floor(qtyMin)) {
      setError("整数模式下最小数量必须为整数");
      return;
    }
    if (integerOnly && qtyMax !== Infinity && qtyMax !== Math.floor(qtyMax)) {
      setError("整数模式下最大数量必须为整数");
      return;
    }

    setError("");

    const n = rowPrices.length;

    if (!integerOnly) {
      // === Non-integer mode: simple proportional split ===
      const allocations: AllocationResult[] = [];
      let usedAmount = 0;

      for (let i = 0; i < n; i++) {
        const price = rowPrices[i];
        if (i < n - 1) {
          const portion = total / n;
          let qty = portion / price;
          if (qtyMax !== Infinity && qty > qtyMax) qty = qtyMax;
          if (qty < qtyMin) qty = qtyMin;
          const subtotal = parseFloat((qty * price).toFixed(10));
          usedAmount += subtotal;
          allocations.push({ price, quantity: parseFloat(qty.toFixed(4)), subtotal });
        } else {
          const remaining = parseFloat((total - usedAmount).toFixed(10));
          if (remaining < 0) {
            setError("无法完成分配，请调整单价或总额");
            return;
          }
          const qty = parseFloat((remaining / price).toFixed(4));
          if (qtyMax !== Infinity && qty > qtyMax) {
            setError(`单价 ${price} 需要数量 ${qty}，超过最大数量 ${qtyMax}`);
            return;
          }
          if (qty < qtyMin) {
            setError(`单价 ${price} 的数量 ${qty} 小于最小数量 ${qtyMin}`);
            return;
          }
          allocations.push({ price, quantity: qty, subtotal: parseFloat((qty * price).toFixed(10)) });
        }
      }
      setResults(allocations);
      return;
    }

    // === Integer mode: scale to avoid floating point ===
    const getDecimals = (v: number) => {
      const s = v.toString();
      const dot = s.indexOf(".");
      return dot === -1 ? 0 : s.length - dot - 1;
    };
    const maxDec = Math.max(...rowPrices.map(getDecimals), getDecimals(total));
    const scale = Math.pow(10, maxDec);

    const sp = rowPrices.map((p) => Math.round(p * scale)); // scaled prices (integers)
    const st = Math.round(total * scale); // scaled total (integer)
    const iMin = Math.round(qtyMin);
    const iMax = qtyMax === Infinity ? Infinity : Math.round(qtyMax);

    // Check: total with all min quantities
    const minSum = sp.reduce((s, p) => s + p * iMin, 0);
    if (minSum > st) {
      setError(
        `所有行以最小数量 ${iMin} 计算已超过总额，请减小最小数量或增加总额`
      );
      return;
    }
    // Check: total with all max quantities
    if (iMax !== Infinity) {
      const maxSum = sp.reduce((s, p) => s + p * iMax, 0);
      if (maxSum < st) {
        setError(
          `所有行以最大数量 ${iMax} 计算仍不足总额，请增大最大数量或减小总额`
        );
        return;
      }
    }

    // Greedy allocation for first n-1 items, then try to fit last item
    // If last item doesn't divide evenly, adjust previous item to find a solution
    const extras = new Array(n).fill(0); // extra qty beyond iMin
    let rem = st - minSum;

    // Distribute to first n-1 items
    for (let i = 0; i < n - 1; i++) {
      const portion = Math.floor(rem / (n - i));
      let extra = Math.floor(portion / sp[i]);
      if (iMax !== Infinity) extra = Math.min(extra, iMax - iMin);
      extras[i] = extra;
      rem -= extra * sp[i];
    }

    // Try to fit the last item
    const tryFitLast = (currentRem: number): number | null => {
      if (currentRem < 0) return null;
      if (currentRem % sp[n - 1] !== 0) return null;
      const q = currentRem / sp[n - 1];
      if (q < 0) return null;
      if (iMax !== Infinity && iMin + q > iMax) return null;
      return q;
    };

    let lastExtra = tryFitLast(rem);

    // If last item doesn't fit, adjust the second-to-last item
    if (lastExtra === null && n >= 2) {
      const prevIdx = n - 2;
      const origExtra = extras[prevIdx];
      const origRem = rem;
      const maxSearch = 1000;

      for (let delta = 1; delta <= maxSearch; delta++) {
        const tryReduce = origExtra - delta;
        if (tryReduce >= 0) {
          const newRem = origRem + delta * sp[prevIdx];
          const fit = tryFitLast(newRem);
          if (fit !== null) {
            extras[prevIdx] = tryReduce;
            lastExtra = fit;
            break;
          }
        }

        const tryIncrease = origExtra + delta;
        const canIncrease = iMax === Infinity || iMin + tryIncrease <= iMax;
        if (canIncrease) {
          const newRem = origRem - delta * sp[prevIdx];
          if (newRem >= 0) {
            const fit = tryFitLast(newRem);
            if (fit !== null) {
              extras[prevIdx] = tryIncrease;
              lastExtra = fit;
              break;
            }
          }
        }
      }
    }

    // If still no solution, try adjusting any earlier item
    if (lastExtra === null && n >= 3) {
      outer: for (let adjIdx = 0; adjIdx < n - 2; adjIdx++) {
        const origExtra = extras[adjIdx];
        const baseRem = rem;
        for (let delta = 1; delta <= 500; delta++) {
          for (const dir of [-1, 1]) {
            const newExtra = origExtra + dir * delta;
            if (newExtra < 0) continue;
            if (iMax !== Infinity && iMin + newExtra > iMax) continue;
            const newRem = baseRem - dir * delta * sp[adjIdx];
            if (newRem < 0) continue;
            const fit = tryFitLast(newRem);
            if (fit !== null) {
              extras[adjIdx] = newExtra;
              lastExtra = fit;
              break outer;
            }
          }
        }
      }
    }

    if (lastExtra === null) {
      setError(
        "在整数数量约束下无法精确匹配总额，请尝试调整总额、单价或数量范围"
      );
      return;
    }

    extras[n - 1] = lastExtra;

    // Build result
    const allocations: AllocationResult[] = rowPrices.map((price, i) => {
      const qty = iMin + extras[i];
      return {
        price,
        quantity: qty,
        subtotal: parseFloat((qty * price).toFixed(10)),
      };
    });

    setResults(allocations);
  }, [prices, selectedPrices, totalAmount, integerOnly, minQty, maxQty, rowCount]);

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">单价分配计算器</h1>
        <p className="text-muted-foreground">
          添加单价，选择参与计算的项目，设置总额后自动计算每个单价对应的数量
        </p>

        {/* Add Price */}
        <Card>
          <CardHeader>
            <CardTitle>添加单价</CardTitle>
            <CardDescription>输入单价并添加到列表中</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="输入单价，如 0.1"
                  value={newPrice}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*\.?\d*$/.test(v)) {
                      setNewPrice(v);
                    }
                  }}
                  onKeyDown={(e) => e.key === "Enter" && addPrice()}
                />
              </div>
              <Button onClick={addPrice}>添加</Button>
            </div>
          </CardContent>
        </Card>

        {/* Price List */}
        {prices.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>单价列表</CardTitle>
                  <CardDescription>
                    点击选择参与计算的单价（已选 {selectedPrices.size}/
                    {prices.length}）
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    全选
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>
                    全不选
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {prices.map((price) => (
                  <Badge
                    key={price}
                    variant={selectedPrices.has(price) ? "default" : "outline"}
                    className="cursor-pointer select-none px-3 py-1.5 text-sm"
                    onClick={() => toggleSelect(price)}
                  >
                    {price}
                    <button
                      className="ml-2 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePrice(price);
                      }}
                    >
                      x
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>计算配置</CardTitle>
            <CardDescription>设置总额和数量约束条件</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="total" className="w-20 shrink-0">
                目标总额
              </Label>
              <Input
                id="total"
                type="text"
                inputMode="decimal"
                value={totalAmount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d*$/.test(v)) {
                    setTotalAmount(v);
                    setResults(null);
                  }
                }}
                className="max-w-xs"
              />
            </div>

            <div className="flex items-center gap-4">
              <Label htmlFor="rowCount" className="w-20 shrink-0">
                生成条数
              </Label>
              <Input
                id="rowCount"
                type="text"
                inputMode="numeric"
                placeholder={`默认与单价数相同（${selectedPrices.size || "-"}）`}
                value={rowCount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d+$/.test(v)) {
                    setRowCount(v);
                    setResults(null);
                  }
                }}
                className="max-w-xs"
              />
            </div>

            <div className="flex items-center gap-4">
              <Label htmlFor="minQty" className="w-20 shrink-0">
                最小数量
              </Label>
              <Input
                id="minQty"
                type="text"
                inputMode="decimal"
                placeholder="默认 0"
                value={minQty}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d*$/.test(v)) {
                    setMinQty(v);
                    setResults(null);
                  }
                }}
                className="max-w-xs"
              />
            </div>

            <div className="flex items-center gap-4">
              <Label htmlFor="maxQty" className="w-20 shrink-0">
                最大数量
              </Label>
              <Input
                id="maxQty"
                type="text"
                inputMode="decimal"
                placeholder="不限制"
                value={maxQty}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d*$/.test(v)) {
                    setMaxQty(v);
                    setResults(null);
                  }
                }}
                className="max-w-xs"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="integerOnly"
                checked={integerOnly}
                onCheckedChange={(checked) => {
                  setIntegerOnly(checked);
                  setResults(null);
                }}
              />
              <Label htmlFor="integerOnly">数量必须为整数</Label>
            </div>

            <Button
              onClick={calculate}
              disabled={selectedPrices.size === 0}
              className="w-full sm:w-auto"
            >
              计算分配
            </Button>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Results */}
        {results && (
          <Card>
            <CardHeader>
              <CardTitle>分配结果</CardTitle>
              <CardDescription>
                各单价对应的数量和小计，合计等于目标总额
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>单价</TableHead>
                    <TableHead className="text-right">数量</TableHead>
                    <TableHead className="text-right">小计</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>{r.price}</TableCell>
                      <TableCell className="text-right">{r.quantity}</TableCell>
                      <TableCell className="text-right">
                        {r.subtotal.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-bold">
                      合计
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {results
                        .reduce((sum, r) => sum + r.subtotal, 0)
                        .toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>

              {/* Formula display */}
              <div className="mt-4 rounded-md bg-muted p-4 font-mono text-sm">
                {results.map((r, i) => (
                  <div key={i}>
                    {r.price} x {r.quantity} = {r.subtotal.toFixed(2)}
                    {i < results.length - 1 ? " +" : ""}
                  </div>
                ))}
                <div className="mt-2 border-t pt-2 font-bold">
                  = {results.reduce((s, r) => s + r.subtotal, 0).toFixed(2)}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
