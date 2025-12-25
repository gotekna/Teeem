# ATO Standard Business Reporting (SBR) Integration Guide

## Overview

This guide covers how to register as an ATO Digital Service Provider (DSP) and integrate SBR for BAS lodgement directly from TEEEM.

---

## What is SBR?

**Standard Business Reporting (SBR)** is Australia's national standard for business-to-government reporting. It allows software like TEEEM to lodge:

- **BAS** - Business Activity Statements
- **IAS** - Instalment Activity Statements
- **STP** - Single Touch Payroll (Phase 2)
- **TPAR** - Taxable Payments Annual Report

The ATO provides free APIs - you just need to register as a DSP.

---

## Step 1: Register as a Digital Service Provider (DSP)

### 1.1 Prerequisites

Before applying, you need:

| Requirement | Details |
|-------------|---------|
| **ABN** | Active Australian Business Number for your company |
| **Business Structure** | Must be a registered Australian entity |
| **Technical Capability** | Ability to implement SBR protocols |
| **Security** | Ability to handle AUSkey/myGovID authentication |

### 1.2 Apply for DSP Registration

1. **Go to:** https://softwaredevelopers.ato.gov.au/
2. **Click:** "Register as a DSP"
3. **Complete the application form:**
   - Business details (ABN, company name)
   - Primary contact details
   - Technical contact details
   - Software product name (TEEEM)
   - Services you want to offer (BAS, STP, etc.)

4. **Wait for approval:** 2-4 weeks typically

### 1.3 After Approval

You receive:
- **DSP ID** - Your unique identifier
- **Access to SBR Test Environment** - For development/testing
- **Production Environment Access** - After passing conformance testing

---

## Step 2: Set Up Development Environment

### 2.1 Access the Developer Portal

**URL:** https://softwaredevelopers.ato.gov.au/

After DSP registration, you can access:
- API documentation
- Test environment credentials
- Sample code and SDKs
- Conformance testing tools

### 2.2 Obtain Test Certificates

SBR uses mutual TLS (mTLS) for authentication. You need:

1. **Software ID Certificate** - Identifies your software
2. **Organisation Certificate** - For your DSP entity
3. **User Credentials** - For testing (provided by ATO)

**To get test certificates:**
```
1. Log in to Developer Portal
2. Go to "Manage Certificates"
3. Generate test certificates
4. Download .p12 files
```

### 2.3 Environment URLs

| Environment | Purpose | URL |
|-------------|---------|-----|
| **EVTE** | Development/Testing | `https://test.sbr.gov.au/` |
| **Production** | Live lodgements | `https://sbr.gov.au/` |

---

## Step 3: Understand the Technical Architecture

### 3.1 SBR Message Flow

```
TEEEM                    SBR Gateway                ATO
  |                          |                       |
  |-- 1. Auth Request ------>|                       |
  |<-- 2. Session Token -----|                       |
  |                          |                       |
  |-- 3. Lodge BAS --------->|                       |
  |                          |-- 4. Validate ------->|
  |                          |<-- 5. Response -------|
  |<-- 6. Lodgement ID ------|                       |
```

### 3.2 Authentication Options

| Method | Description | Use Case |
|--------|-------------|----------|
| **Machine Credential** | Software-to-software | Automated lodgements |
| **myGovID** | User authentication | User-initiated lodgements |
| **AUSkey** | Legacy (being phased out) | Existing integrations |

**Recommended:** Machine Credential for automated BAS lodgement

### 3.3 Message Format

SBR uses **XBRL** (eXtensible Business Reporting Language) wrapped in SOAP:

```xml
<soap:Envelope>
  <soap:Header>
    <sbr:Sender>
      <sbr:SoftwareId>YOUR_SOFTWARE_ID</sbr:SoftwareId>
    </sbr:Sender>
  </soap:Header>
  <soap:Body>
    <xbrli:xbrl>
      <!-- BAS data in XBRL format -->
    </xbrli:xbrl>
  </soap:Body>
</soap:Envelope>
```

---

## Step 4: BAS Data Requirements

### 4.1 BAS Form Fields (Common)

| Field | Label | XBRL Element |
|-------|-------|--------------|
| **1A** | GST on sales | `gst.salesTotalAmount` |
| **1B** | GST on purchases | `gst.purchasesTotalAmount` |
| **1C** | GST refund/payable | `gst.netAmount` |
| **W1** | Total salary/wages | `payg.totalGrossSalaryWages` |
| **W2** | Amounts withheld | `payg.totalAmountsWithheld` |
| **W3** | Other amounts withheld | `payg.otherAmountsWithheld` |
| **W4** | Total PAYG withheld | `payg.totalWithheld` |
| **T1** | Instalment income | `paygi.instalmentIncome` |

### 4.2 Data Mapping from TEEEM

```ruby
# Map TEEEM GL data to BAS fields
class BasDataMapper
  def initialize(corporate_company, period)
    @company = corporate_company
    @period = period # e.g., "2024-Q1"
  end

  def to_bas_fields
    {
      # GST Fields
      "1A" => calculate_gst_on_sales,      # GST collected
      "1B" => calculate_gst_on_purchases,  # GST paid (credits)

      # PAYG Withholding (if applicable)
      "W1" => calculate_total_wages,
      "W2" => calculate_payg_withheld,

      # PAYG Instalments
      "T1" => calculate_instalment_income
    }
  end

  private

  def calculate_gst_on_sales
    # Sum of GST liability account for period
    Gl::LedgerLine
      .where(corporate_company: @company)
      .where(gl_account: gst_collected_account)
      .where(entry_date: @period.date_range)
      .sum(:credit)
  end

  def calculate_gst_on_purchases
    # Sum of GST asset account for period
    Gl::LedgerLine
      .where(corporate_company: @company)
      .where(gl_account: gst_paid_account)
      .where(entry_date: @period.date_range)
      .sum(:debit)
  end
end
```

---

## Step 5: Implementation Plan

### 5.1 Backend Components to Build

| Component | Purpose | Priority |
|-----------|---------|----------|
| `SbrClient` | SOAP client for SBR API | P1 |
| `BasLodgementService` | Prepare and lodge BAS | P1 |
| `XbrlBuilder` | Build XBRL messages | P1 |
| `SbrCredentialManager` | Manage certificates | P1 |
| `BasPeriod` | Track BAS periods | P2 |
| `BasLodgement` (model) | Store lodgement history | P2 |

### 5.2 Suggested File Structure

```
backend/
├── app/
│   ├── models/
│   │   └── gl/
│   │       ├── bas_period.rb
│   │       └── bas_lodgement.rb
│   ├── services/
│   │   └── sbr/
│   │       ├── client.rb           # SOAP client
│   │       ├── authenticator.rb    # Handle auth
│   │       ├── xbrl_builder.rb     # Build XBRL
│   │       └── bas_lodger.rb       # Lodge BAS
│   └── controllers/
│       └── api/v1/gl/
│           └── bas_controller.rb
├── config/
│   └── sbr/
│       ├── taxonomies/             # XBRL taxonomies
│       └── certificates/           # SBR certificates (gitignored)
```

### 5.3 Environment Variables Needed

```bash
# SBR Configuration
SBR_ENVIRONMENT=evte                    # evte or production
SBR_DSP_ID=your_dsp_id
SBR_SOFTWARE_ID=TEEEM_001
SBR_GATEWAY_URL=https://test.sbr.gov.au/services

# Certificates (base64 encoded or file paths)
SBR_CERT_PATH=/path/to/certificate.p12
SBR_CERT_PASSWORD=your_cert_password
SBR_CA_CERT_PATH=/path/to/ca-bundle.crt
```

---

## Step 6: Conformance Testing

Before going live, you must pass ATO conformance testing.

### 6.1 What's Tested

1. **Message Format** - Correct XBRL structure
2. **Authentication** - Proper certificate handling
3. **Error Handling** - Response to error codes
4. **Data Validation** - Correct calculations
5. **Security** - mTLS implementation

### 6.2 Conformance Process

1. **Self-Testing** - Use EVTE environment
2. **Submit Test Results** - Via Developer Portal
3. **ATO Review** - 1-2 weeks
4. **Approval** - Receive production access

### 6.3 Common Test Scenarios

| Scenario | Description |
|----------|-------------|
| **Happy Path** | Successful BAS lodgement |
| **Validation Error** | Invalid ABN, incorrect amounts |
| **Auth Failure** | Expired certificate |
| **Amendment** | Revise previously lodged BAS |

---

## Step 7: Sample Code Structure

### 7.1 SBR Client (Ruby)

```ruby
# app/services/sbr/client.rb
module Sbr
  class Client
    include Savon::Client

    EVTE_URL = "https://test.sbr.gov.au/services/sbr"
    PROD_URL = "https://sbr.gov.au/services/sbr"

    def initialize
      @environment = ENV["SBR_ENVIRONMENT"] || "evte"
      @certificate = load_certificate
    end

    def lodge_bas(bas_data)
      message = XbrlBuilder.new(bas_data).build

      response = client.call(:lodge, message_tag: "LodgeRequest") do
        message(message)
      end

      parse_response(response)
    end

    private

    def client
      @client ||= Savon.client(
        wsdl: wsdl_url,
        ssl_cert_file: @certificate[:cert_path],
        ssl_cert_key_file: @certificate[:key_path],
        ssl_ca_cert_file: ENV["SBR_CA_CERT_PATH"],
        ssl_verify_mode: :peer,
        log: Rails.env.development?
      )
    end

    def wsdl_url
      @environment == "production" ? PROD_URL : EVTE_URL
    end

    def load_certificate
      # Load P12 certificate
      {
        cert_path: ENV["SBR_CERT_PATH"],
        key_path: ENV["SBR_KEY_PATH"]
      }
    end
  end
end
```

### 7.2 BAS Lodgement Service

```ruby
# app/services/sbr/bas_lodger.rb
module Sbr
  class BasLodger
    def initialize(corporate_company)
      @company = corporate_company
      @client = Client.new
    end

    def lodge(period:, amendment: false)
      # Validate prerequisites
      validate_can_lodge!(period)

      # Prepare BAS data
      bas_data = prepare_bas_data(period)

      # Create lodgement record
      lodgement = Gl::BasLodgement.create!(
        corporate_company: @company,
        period: period,
        status: "pending",
        data: bas_data,
        is_amendment: amendment
      )

      # Lodge with ATO
      response = @client.lodge_bas(bas_data)

      # Update lodgement status
      if response[:success]
        lodgement.update!(
          status: "lodged",
          lodgement_reference: response[:reference],
          lodged_at: Time.current
        )
      else
        lodgement.update!(
          status: "failed",
          error_message: response[:error]
        )
      end

      lodgement
    end

    private

    def validate_can_lodge!(period)
      # Check period is valid
      raise "Invalid period" unless valid_period?(period)

      # Check not already lodged (unless amendment)
      existing = Gl::BasLodgement.where(
        corporate_company: @company,
        period: period,
        status: "lodged"
      ).exists?

      raise "Already lodged for this period" if existing && !amendment
    end

    def prepare_bas_data(period)
      mapper = BasDataMapper.new(@company, period)

      {
        abn: @company.abn,
        period: period,
        fields: mapper.to_bas_fields,
        declaration: {
          declarant_name: Current.user&.name,
          declaration_date: Date.current
        }
      }
    end
  end
end
```

---

## Step 8: Timeline Estimate

| Phase | Duration | Activities |
|-------|----------|------------|
| **DSP Registration** | 2-4 weeks | Apply, wait for approval |
| **Development** | 4-6 weeks | Build SBR client, XBRL builder |
| **Self-Testing** | 2 weeks | Test in EVTE environment |
| **Conformance** | 2-4 weeks | Submit and pass ATO tests |
| **Production** | 1 week | Deploy and go live |
| **Total** | 11-17 weeks | ~3-4 months |

---

## Step 9: Costs

| Item | Cost | Notes |
|------|------|-------|
| **DSP Registration** | FREE | No fee from ATO |
| **SBR API Access** | FREE | No per-transaction cost |
| **Certificates** | ~$200/year | Digital certificate renewal |
| **Development** | Internal | Engineering time |

**Total ongoing cost: ~$200/year** for certificate renewal

---

## Step 10: Alternative - Use a Gateway Provider

If DSP registration is too complex, you can use a gateway provider:

| Provider | Description | Cost |
|----------|-------------|------|
| **Ozedi** | BAS/STP gateway | Per-lodgement fee |
| **MessageXchange** | Full SBR gateway | Monthly + per-message |
| **Reckon** | Accounting platform | Integration fee |

These providers handle the ATO connection - you just send them data via their simpler API.

---

## Resources

### Official ATO Links

- **Developer Portal:** https://softwaredevelopers.ato.gov.au/
- **SBR Documentation:** https://www.sbr.gov.au/
- **Technical Specifications:** https://softwaredevelopers.ato.gov.au/technical-specifications
- **XBRL Taxonomies:** https://softwaredevelopers.ato.gov.au/taxonomy

### Sample Projects

- **ATO Reference Implementation:** Available on Developer Portal after registration
- **Ruby XBRL Gem:** `gem 'xbrl'` - Basic XBRL parsing

### Support

- **ATO Developer Support:** developer@ato.gov.au
- **SBR Helpdesk:** 1300 852 232

---

## Next Steps for TEEEM

1. **Register as DSP** - Apply at https://softwaredevelopers.ato.gov.au/
2. **Obtain Test Credentials** - After approval
3. **Build SBR Client** - Using this guide
4. **Test in EVTE** - Validate BAS lodgement
5. **Pass Conformance** - Submit for ATO approval
6. **Go Live** - Enable for customers

---

## Appendix: BAS Period Codes

| Code | Description | Due Date |
|------|-------------|----------|
| **Q1** | July-September | 28 October |
| **Q2** | October-December | 28 February |
| **Q3** | January-March | 28 April |
| **Q4** | April-June | 28 July |
| **M01-M12** | Monthly lodgers | 21st of following month |

---

*Document Version: 1.0*
*Last Updated: 2025-12-26*
