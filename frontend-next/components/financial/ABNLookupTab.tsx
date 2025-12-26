"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import {
  Search,
  Building2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Hash,
  MapPin,
  Calendar,
  FileText,
  Copy,
  Check,
  ExternalLink,
  History,
  Briefcase,
} from "lucide-react";
import { api } from "@/lib/api";

interface ABNResult {
  success: boolean;
  valid?: boolean;
  abn?: string;
  entity_name?: string;
  entity_type?: string;
  gst_registered?: boolean;
  active?: boolean;
  error?: string;
  checksum_valid?: boolean;
}

interface ASICLookupResult {
  success: boolean;
  data?: {
    name: string;
    abn: string | null;
    acn: string | null;
    entity_type_code: string;
    status: string;
    gst_registered: boolean;
    gst_effective_from: string | null;
    registered_address: string | null;
    main_business_location: string | null;
    trading_names: Array<{ name: string }>;
  };
  error?: string;
}

interface SearchResult {
  success: boolean;
  data?: Array<{
    name: string;
    abn: string | null;
    acn: string | null;
    state: string | null;
    postcode: string | null;
    status: string;
  }>;
  error?: string;
}

interface LookupHistoryItem {
  type: "abn" | "acn" | "name";
  query: string;
  result: string;
  timestamp: Date;
  success: boolean;
}

export default function ABNLookupTab() {
  const [activeTab, setActiveTab] = useState<"abn" | "acn" | "name">("abn");
  const [abnInput, setABNInput] = useState("");
  const [acnInput, setACNInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [stateInput, setStateInput] = useState("");
  const [postcodeInput, setPostcodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [abnResult, setABNResult] = useState<ABNResult | null>(null);
  const [asicResult, setASICResult] = useState<ASICLookupResult | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [history, setHistory] = useState<LookupHistoryItem[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const addToHistory = (
    type: "abn" | "acn" | "name",
    query: string,
    result: string,
    success: boolean
  ) => {
    setHistory((prev) => [
      { type, query, result, timestamp: new Date(), success },
      ...prev.slice(0, 19), // Keep last 20 items
    ]);
  };

  const handleABNLookup = useCallback(async () => {
    if (!abnInput.trim()) return;
    setLoading(true);
    setABNResult(null);
    setASICResult(null);

    try {
      // First validate via ABR
      const abnResponse = await api.get<ABNResult>(
        `/api/v1/contacts/validate_abn?abn=${encodeURIComponent(abnInput)}`
      );

      setABNResult(abnResponse);

      // Also try ASIC lookup for more details
      const asicResponse = await api.get<ASICLookupResult>(
        `/api/v1/asic/lookup_abn?abn=${encodeURIComponent(abnInput)}`
      );

      if (asicResponse.success) {
        setASICResult(asicResponse);
      }

      addToHistory(
        "abn",
        abnInput,
        abnResponse.entity_name || abnResponse.error || "Unknown",
        abnResponse.valid === true
      );
    } catch (error) {
      console.error("ABN lookup failed:", error);
      setABNResult({ success: false, error: "Lookup failed" });
      addToHistory("abn", abnInput, "Lookup failed", false);
    } finally {
      setLoading(false);
    }
  }, [abnInput]);

  const handleACNLookup = useCallback(async () => {
    if (!acnInput.trim()) return;
    setLoading(true);
    setASICResult(null);

    try {
      const response = await api.get<ASICLookupResult>(
        `/api/v1/asic/lookup_acn?acn=${encodeURIComponent(acnInput)}`
      );

      setASICResult(response);
      addToHistory(
        "acn",
        acnInput,
        response.data?.name || response.error || "Unknown",
        response.success
      );
    } catch (error) {
      console.error("ACN lookup failed:", error);
      setASICResult({ success: false, error: "Lookup failed" });
      addToHistory("acn", acnInput, "Lookup failed", false);
    } finally {
      setLoading(false);
    }
  }, [acnInput]);

  const handleNameSearch = useCallback(async () => {
    if (!nameInput.trim()) return;
    setLoading(true);
    setSearchResults(null);

    try {
      let url = `/api/v1/asic/search?name=${encodeURIComponent(nameInput)}`;
      if (stateInput) url += `&state=${encodeURIComponent(stateInput)}`;
      if (postcodeInput) url += `&postcode=${encodeURIComponent(postcodeInput)}`;

      const response = await api.get<SearchResult>(url);

      setSearchResults(response);
      addToHistory(
        "name",
        nameInput,
        response.data?.length
          ? `${response.data.length} results`
          : response.error || "No results",
        response.success
      );
    } catch (error) {
      console.error("Name search failed:", error);
      setSearchResults({ success: false, error: "Search failed" });
      addToHistory("name", nameInput, "Search failed", false);
    } finally {
      setLoading(false);
    }
  }, [nameInput, stateInput, postcodeInput]);

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatABN = (abn: string) => {
    const clean = abn.replace(/\s/g, "");
    if (clean.length !== 11) return abn;
    return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 11)}`;
  };

  const formatACN = (acn: string) => {
    const clean = acn.replace(/\s/g, "");
    if (clean.length !== 9) return acn;
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)}`;
  };

  const getEntityTypeBadge = (code: string) => {
    const types: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      PRV: { label: "Pty Ltd", variant: "default" },
      PUB: { label: "Public", variant: "secondary" },
      IND: { label: "Sole Trader", variant: "outline" },
      PTR: { label: "Partnership", variant: "outline" },
      TRT: { label: "Trust", variant: "secondary" },
      OIE: { label: "Other", variant: "outline" },
    };
    const type = types[code] || { label: code, variant: "outline" as const };
    return <Badge variant={type.variant}>{type.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Search className="h-6 w-6" />
          ABN / ACN Lookup
        </h2>
        <p className="text-muted-foreground">
          Search the Australian Business Register and ASIC
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search Panel */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="pt-6">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="abn" className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    ABN Lookup
                  </TabsTrigger>
                  <TabsTrigger value="acn" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    ACN Lookup
                  </TabsTrigger>
                  <TabsTrigger value="name" className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Name Search
                  </TabsTrigger>
                </TabsList>

                {/* ABN Lookup */}
                <TabsContent value="abn" className="space-y-4 mt-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label htmlFor="abn">Australian Business Number (ABN)</Label>
                      <Input
                        id="abn"
                        placeholder="e.g., 51 824 753 556"
                        value={abnInput}
                        onChange={(e) => setABNInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleABNLookup()}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleABNLookup} disabled={loading || !abnInput.trim()}>
                        {loading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                        <span className="ml-2">Lookup</span>
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enter an 11-digit ABN to verify business details and GST registration status
                  </p>
                </TabsContent>

                {/* ACN Lookup */}
                <TabsContent value="acn" className="space-y-4 mt-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label htmlFor="acn">Australian Company Number (ACN)</Label>
                      <Input
                        id="acn"
                        placeholder="e.g., 123 456 789"
                        value={acnInput}
                        onChange={(e) => setACNInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleACNLookup()}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleACNLookup} disabled={loading || !acnInput.trim()}>
                        {loading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                        <span className="ml-2">Lookup</span>
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enter a 9-digit ACN to retrieve company information from ASIC
                  </p>
                </TabsContent>

                {/* Name Search */}
                <TabsContent value="name" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="name">Company Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g., Acme Pty Ltd"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleNameSearch()}
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State (Optional)</Label>
                      <Input
                        id="state"
                        placeholder="e.g., NSW"
                        value={stateInput}
                        onChange={(e) => setStateInput(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="postcode">Postcode (Optional)</Label>
                      <Input
                        id="postcode"
                        placeholder="e.g., 2000"
                        value={postcodeInput}
                        onChange={(e) => setPostcodeInput(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={handleNameSearch} disabled={loading || !nameInput.trim()}>
                    {loading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                    <span className="ml-2">Search</span>
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Results */}
          {(abnResult || asicResult) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {abnResult?.valid || asicResult?.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  Lookup Result
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {abnResult?.error && !abnResult?.valid && (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    <span>{abnResult.error}</span>
                  </div>
                )}

                {(abnResult?.valid || asicResult?.success) && (
                  <div className="space-y-4">
                    {/* Entity Name */}
                    <div className="flex items-start justify-between">
                      <div>
                        <Label className="text-muted-foreground">Entity Name</Label>
                        <p className="text-lg font-semibold">
                          {asicResult?.data?.name || abnResult?.entity_name || "Unknown"}
                        </p>
                      </div>
                      {asicResult?.data?.entity_type_code &&
                        getEntityTypeBadge(asicResult.data.entity_type_code)}
                    </div>

                    {/* ABN & ACN */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(abnResult?.abn || asicResult?.data?.abn) && (
                        <div>
                          <Label className="text-muted-foreground">ABN</Label>
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-lg">
                              {formatABN(asicResult?.data?.abn || abnResult?.abn || "")}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleCopy(
                                  (asicResult?.data?.abn || abnResult?.abn || "").replace(/\s/g, ""),
                                  "abn"
                                )
                              }
                            >
                              {copied === "abn" ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}

                      {asicResult?.data?.acn && (
                        <div>
                          <Label className="text-muted-foreground">ACN</Label>
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-lg">
                              {formatACN(asicResult.data.acn)}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleCopy(asicResult.data!.acn!.replace(/\s/g, ""), "acn")
                              }
                            >
                              {copied === "acn" ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status & GST */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Status</Label>
                        <div className="flex items-center gap-2 mt-1">
                          {(abnResult?.active || asicResult?.data?.status === "ACT") ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label className="text-muted-foreground">GST Registration</Label>
                        <div className="flex items-center gap-2 mt-1">
                          {(abnResult?.gst_registered || asicResult?.data?.gst_registered) ? (
                            <Badge variant="default" className="bg-blue-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              GST Registered
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="h-3 w-3 mr-1" />
                              Not GST Registered
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Entity Type */}
                    {(abnResult?.entity_type || asicResult?.data?.entity_type_code) && (
                      <div>
                        <Label className="text-muted-foreground">Entity Type</Label>
                        <p>{abnResult?.entity_type || asicResult?.data?.entity_type_code}</p>
                      </div>
                    )}

                    {/* Address */}
                    {(asicResult?.data?.registered_address ||
                      asicResult?.data?.main_business_location) && (
                      <div>
                        <Label className="text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          Address
                        </Label>
                        <p>
                          {asicResult.data.registered_address ||
                            asicResult.data.main_business_location}
                        </p>
                      </div>
                    )}

                    {/* Trading Names */}
                    {asicResult?.data?.trading_names && asicResult.data.trading_names.length > 0 && (
                      <div>
                        <Label className="text-muted-foreground flex items-center gap-1">
                          <Briefcase className="h-4 w-4" />
                          Trading Names
                        </Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {asicResult.data.trading_names.map((tn, i) => (
                            <Badge key={i} variant="outline">
                              {tn.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* GST Effective Date */}
                    {asicResult?.data?.gst_effective_from && (
                      <div>
                        <Label className="text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          GST Effective From
                        </Label>
                        <p>
                          {new Date(asicResult.data.gst_effective_from).toLocaleDateString("en-AU")}
                        </p>
                      </div>
                    )}

                    {/* External Links */}
                    <div className="flex gap-2 pt-4 border-t">
                      {abnResult?.abn && (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={`https://abr.business.gov.au/ABN/View?id=${(abnResult.abn || "").replace(/\s/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View on ABR
                          </a>
                        </Button>
                      )}
                      {asicResult?.data?.acn && (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={`https://asic.gov.au/online-services/search-asic-s-registers/`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            ASIC Search
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Name Search Results */}
          {searchResults && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Search Results</span>
                  {searchResults.data && (
                    <Badge variant="secondary">{searchResults.data.length} found</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {searchResults.error ? (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    <span>{searchResults.error}</span>
                  </div>
                ) : searchResults.data && searchResults.data.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>ABN</TableHead>
                        <TableHead>ACN</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResults.data.map((result, index) => (
                        <TableRow
                          key={index}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            if (result.abn) {
                              setABNInput(result.abn);
                              setActiveTab("abn");
                            } else if (result.acn) {
                              setACNInput(result.acn);
                              setActiveTab("acn");
                            }
                          }}
                        >
                          <TableCell className="font-medium">{result.name}</TableCell>
                          <TableCell className="font-mono">
                            {result.abn ? formatABN(result.abn) : "-"}
                          </TableCell>
                          <TableCell className="font-mono">
                            {result.acn ? formatACN(result.acn) : "-"}
                          </TableCell>
                          <TableCell>
                            {[result.state, result.postcode].filter(Boolean).join(" ") || "-"}
                          </TableCell>
                          <TableCell>
                            {result.status === "ACT" ? (
                              <Badge variant="default" className="bg-green-600">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary">{result.status || "Unknown"}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No results found for "{nameInput}"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* History Panel */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Lookups
              </CardTitle>
              <CardDescription>Click to search again</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No lookups yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        if (item.type === "abn") {
                          setABNInput(item.query);
                          setActiveTab("abn");
                        } else if (item.type === "acn") {
                          setACNInput(item.query);
                          setActiveTab("acn");
                        } else {
                          setNameInput(item.query);
                          setActiveTab("name");
                        }
                      }}
                    >
                      <div className="flex-shrink-0">
                        {item.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {item.type.toUpperCase()}
                          </Badge>
                          <span className="font-mono text-sm truncate">{item.query}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{item.result}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">About ABN/ACN</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>ABN</strong> (Australian Business Number) is an 11-digit identifier for
                businesses registered with the Australian Business Register.
              </p>
              <p>
                <strong>ACN</strong> (Australian Company Number) is a 9-digit identifier for
                companies registered with ASIC.
              </p>
              <p>
                <strong>GST Registration</strong> is required for businesses with annual turnover
                of $75,000 or more.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
