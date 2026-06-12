import React from 'react';
import {
  LEGAL_MODAL_H3,
  LEGAL_MODAL_LINK,
  LEGAL_MODAL_LIST,
  LEGAL_MODAL_LIST_SPACED,
  LEGAL_MODAL_META,
  LEGAL_MODAL_ROOT,
  LEGAL_MODAL_SECTION,
} from './legalModalStyles';

const TermsOfService: React.FC = () => {
  return (
    <div className={LEGAL_MODAL_ROOT}>
      <section className={LEGAL_MODAL_SECTION}>
        <h2 className={`${LEGAL_MODAL_H3} text-xl`}>Concrete Calc Terms of Service</h2>
        <p className={LEGAL_MODAL_META}>Last Updated: 12 June 2026</p>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Concrete Calc,
          including our websites, web application, mobile or progressive web application, calculators,
          estimating tools, proposal tools, scheduling tools, project management tools, client portal
          features, accounting and tax export tools, emails, APIs, and any related services we provide
          (collectively, the &ldquo;Service&rdquo;).
        </p>
        <p>
          These Terms form a legally binding agreement between you and{' '}
          <strong>ConcreteCalc, LLC</strong> (&ldquo;Concrete Calc,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo;
          or &ldquo;our&rdquo;). If your legal entity name is different, replace &ldquo;ConcreteCalc, LLC&rdquo;
          with the correct legal name before publishing.
        </p>
        <p>
          By creating an account, accessing the Service, using a free trial, subscribing to a paid plan,
          inviting users or clients, generating proposals, sending emails, exporting files, or otherwise
          using the Service, you agree to these Terms and our Privacy Policy. If you do not agree, do not
          use the Service.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>1. Eligibility and Authority</h3>
        <p>You must be at least 18 years old and legally able to enter into contracts to use the Service.</p>
        <p>
          If you use the Service on behalf of a company, contractor, organization, government entity,
          partnership, or other business, you represent that you have authority to bind that entity to
          these Terms. In that case, &ldquo;you&rdquo; and &ldquo;your&rdquo; refer to both you individually
          and the entity you represent.
        </p>
        <p>
          You are responsible for ensuring that your use of the Service complies with all laws, regulations,
          licensing requirements, tax obligations, contract requirements, procurement rules, labor rules, and
          professional standards that apply to your work.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>2. Description of the Service</h3>
        <p>
          Concrete Calc provides software tools for contractors and construction professionals, including
          some or all of the following:
        </p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Project setup and project dashboards</li>
          <li>Client and project records</li>
          <li>Concrete calculators and construction calculators</li>
          <li>Construction activity estimating</li>
          <li>Production-rate based estimating</li>
          <li>Labor rate schedules and cost rollups</li>
          <li>Proposal generation, preview, export, and email delivery</li>
          <li>Project files, RFIs, FARs, change orders, QC records, and field activity tools</li>
          <li>Schedule Preview, Logic Network, CPM, Level III Gantt, crew demand, and related planning tools</li>
          <li>Project charts, dashboards, and reports</li>
          <li>Accounting and tax export tools</li>
          <li>Client portal or share-link functionality</li>
          <li>
            Integrations with third-party providers such as payment processors, email providers, accounting
            platforms, hosting providers, and storage providers
          </li>
        </ul>
        <p>We may add, remove, modify, rename, or discontinue features at any time.</p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>3. No Professional, Engineering, Legal, Tax, or Financial Advice</h3>
        <p>Concrete Calc is a software tool. It does not provide professional advice.</p>
        <p>
          The Service may generate calculations, estimates, schedules, production-rate outputs, proposal
          documents, risk indicators, tax summaries, accounting exports, weather-related suggestions, or other
          business information. These outputs are for informational and planning purposes only.
        </p>
        <p>
          You are solely responsible for reviewing, verifying, and approving all outputs before using them
          for bids, contracts, schedules, purchases, construction activities, safety planning, tax filings,
          accounting records, client communications, or business decisions.
        </p>
        <p>Concrete Calc does not replace:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Licensed contractors</li>
          <li>Engineers</li>
          <li>Architects</li>
          <li>Accountants</li>
          <li>CPAs</li>
          <li>Tax professionals</li>
          <li>Attorneys</li>
          <li>Safety professionals</li>
          <li>Project managers</li>
          <li>Estimators</li>
          <li>Inspectors</li>
          <li>Local code officials</li>
          <li>Manufacturers&rsquo; instructions</li>
          <li>Contract documents</li>
          <li>Plans and specifications</li>
          <li>Applicable laws, codes, standards, permits, and regulations</li>
        </ul>
        <p>
          You are responsible for confirming quantities, measurements, production rates, crew sizes, labor
          rates, material pricing, equipment pricing, markup, overhead, profit, taxes, schedules, project
          risks, and all other project assumptions.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>4. Construction Estimates, Production Rates, and Calculations</h3>
        <p>
          The Service may include production-rate libraries, construction activities, man-hour calculations,
          labor rates, markup settings, cost summaries, and project estimates.
        </p>
        <p>
          You understand and agree that all estimating outputs are dependent on the information entered,
          selected, imported, or configured by you or your users. Actual project costs, labor productivity,
          material quantities, crew performance, equipment usage, weather conditions, site conditions,
          subcontractor pricing, supplier pricing, permit requirements, inspection requirements, and market
          conditions may differ significantly from software-generated estimates.
        </p>
        <p>Concrete Calc does not guarantee:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Accuracy of any estimate</li>
          <li>Suitability of any production rate for your project</li>
          <li>Actual labor productivity</li>
          <li>Actual project duration</li>
          <li>Availability or cost of materials</li>
          <li>Availability or cost of equipment</li>
          <li>Subcontractor pricing</li>
          <li>Project profitability</li>
          <li>Bid success</li>
          <li>Contract award</li>
          <li>Compliance with any bid requirement</li>
          <li>Compliance with any contract requirement</li>
        </ul>
        <p>
          You are responsible for independently validating all estimates before submitting proposals, bids,
          invoices, schedules, or contracts.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>5. Scheduling, Logic Network, CPM, Gantt, and Crew Planning</h3>
        <p>
          The Service may provide scheduling tools, including Schedule Preview, Logic Network, CPM
          calculations, Level III Gantt charts, crew demand charts, float calculations, and related planning
          features.
        </p>
        <p>
          Scheduling outputs depend on user-entered durations, logic links, crew assumptions, activity
          selections, calendars, constraints, and project data. Concrete Calc does not guarantee that a
          generated schedule is feasible, contract-compliant, resource-loaded, risk-adjusted, or suitable for
          submission to an owner, general contractor, government entity, or any other party.
        </p>
        <p>You are responsible for reviewing and validating:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Activity durations</li>
          <li>Logic relationships</li>
          <li>Critical path</li>
          <li>Float values</li>
          <li>Crew assumptions</li>
          <li>Resource availability</li>
          <li>Sequencing</li>
          <li>Schedule constraints</li>
          <li>Weather assumptions</li>
          <li>Contract schedule requirements</li>
          <li>Delay impacts</li>
          <li>Updates and actual progress</li>
        </ul>
        <p>The Service is a planning aid and does not replace professional scheduling judgment.</p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>6. Proposals, Client Communications, and Shared Links</h3>
        <p>
          The Service may allow you to create, preview, download, share, and email proposals or other
          project documents.
        </p>
        <p>
          You are solely responsible for reviewing all proposal content before sending it to any client,
          owner, contractor, subcontractor, supplier, or third party. This includes reviewing pricing, scope
          of work, exclusions, assumptions, dates, client information, business information, terms, taxes,
          attachments, public links, and any generated text.
        </p>
        <p>If you send proposals or other communications through the Service, you represent that:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>You have permission to contact the recipient</li>
          <li>The recipient information is accurate</li>
          <li>The communication is lawful</li>
          <li>
            The communication does not violate spam, privacy, consumer protection, procurement, or contract
            laws
          </li>
          <li>You have authority to send the communication on behalf of your business</li>
        </ul>
        <p>
          Shared links, proposal links, client portal links, or public tokens may allow third parties to view
          certain information. You are responsible for deciding what to share and with whom. Do not share
          confidential, sensitive, regulated, or private information unless you are authorized to do so.
        </p>
        <p>
          We may track delivery, open, click, and status events for emails or shared links where supported by
          our service providers.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>7. Client Portal and Third-Party Access</h3>
        <p>
          The Service may allow you to invite clients, employees, subcontractors, team members, or other
          third parties to view or interact with certain project information.
        </p>
        <p>You are responsible for:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Selecting the correct recipient</li>
          <li>Assigning appropriate access</li>
          <li>Removing access when no longer needed</li>
          <li>
            Ensuring client or third-party access complies with your contracts and privacy obligations
          </li>
          <li>Ensuring information shared through the Service is appropriate and accurate</li>
        </ul>
        <p>
          We are not responsible for harm caused by your decision to share project information, proposals,
          files, estimates, schedules, or communications with any person or entity.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>8. Accounting and Tax Export Tools</h3>
        <p>
          The Service may provide accounting and tax-related export features, including year-end summaries,
          Schedule C style summaries, CPA workbooks, revenue exports, expense exports, QuickBooks-related
          exports, TurboTax helper exports, and other tax or accounting reports.
        </p>
        <p>
          These features are business record tools only. They are not tax advice, accounting advice, legal
          advice, financial advice, or a substitute for a CPA, accountant, bookkeeper, tax professional, or
          attorney.
        </p>
        <p>
          Any &ldquo;Schedule C style&rdquo; summary is not an official IRS form. Any &ldquo;TurboTax helper
          export&rdquo; or similarly named export is intended only to assist with data entry or review where
          practical. We do not guarantee that any export will be accepted by TurboTax, QuickBooks, Intuit, the
          IRS, any state taxing authority, any CPA, or any accounting platform.
        </p>
        <p>You are solely responsible for:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Reviewing all exported data</li>
          <li>Confirming the correct tax year</li>
          <li>Confirming cash or accrual treatment</li>
          <li>Confirming revenue recognition</li>
          <li>Confirming expense categorization</li>
          <li>Confirming deductible expenses</li>
          <li>Confirming business entity treatment</li>
          <li>Maintaining required books and records</li>
          <li>Filing accurate tax returns</li>
          <li>Paying taxes, fees, penalties, and interest</li>
          <li>Consulting qualified professionals</li>
        </ul>
        <p>
          Concrete Calc does not guarantee tax savings, tax compliance, audit protection, accounting
          accuracy, or acceptance by any third-party software or tax authority.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>9. Third-Party Services and Integrations</h3>
        <p>The Service may use or integrate with third-party services, including but not limited to:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Stripe or other payment processors</li>
          <li>Resend or other email providers</li>
          <li>Supabase or other database/authentication providers</li>
          <li>Netlify or other hosting providers</li>
          <li>Intuit, QuickBooks, or other accounting platforms</li>
          <li>Mapping, weather, storage, analytics, or notification providers</li>
          <li>App stores, browsers, operating systems, or device platforms</li>
        </ul>
        <p>
          Your use of third-party services may be subject to separate terms, privacy policies, fees,
          limitations, and availability. We are not responsible for third-party services, outages, data
          handling, security incidents, pricing changes, API changes, denied integrations, rejected exports,
          or discontinued functionality.
        </p>
        <p>
          We may modify, suspend, or remove integrations if a third-party provider changes its service,
          terms, pricing, security requirements, API access, or approval status.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>10. Accounts and Security</h3>
        <p>
          You may need an account to use certain features. You agree to provide accurate, current, and
          complete information and to keep it updated.
        </p>
        <p>You are responsible for:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Maintaining the confidentiality of your login credentials</li>
          <li>Securing your devices</li>
          <li>Controlling access by your employees, clients, subcontractors, and team members</li>
          <li>All activity under your account</li>
          <li>Promptly notifying us of unauthorized access or suspected security issues</li>
        </ul>
        <p>
          We are not liable for losses caused by unauthorized use of your account unless caused by our gross
          negligence or willful misconduct.
        </p>
        <p>
          We may require multi-factor authentication, password resets, email verification, or other security
          measures.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>11. Organizations, Team Members, and Permissions</h3>
        <p>
          If your account includes team features, you are responsible for managing users, roles, permissions,
          invitations, and access levels.
        </p>
        <p>
          You are responsible for all actions taken by users you invite or authorize. You agree to remove
          access for users who leave your organization or no longer need access.
        </p>
        <p>Certain administrative features may be limited to account owners, admins, or authorized roles.</p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>12. Subscriptions, Trials, Billing, and Payment</h3>
        <p>
          Some features require a paid subscription. Subscription plans, features, limits, pricing, and
          billing intervals may be shown on our pricing page, checkout page, account page, or other order
          flow.
        </p>
        <p>
          By starting a paid subscription or free trial that converts to a paid subscription, you authorize us
          and our payment processor to charge your payment method for applicable fees, taxes, renewals,
          upgrades, add-ons, and other charges.
        </p>
        <p>Unless otherwise stated:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Subscriptions renew automatically until canceled</li>
          <li>Fees are billed in advance</li>
          <li>You are responsible for all applicable taxes</li>
          <li>Paid fees are non-refundable except where required by law or expressly stated</li>
          <li>Plan limits may apply to projects, users, storage, exports, features, integrations, or other usage</li>
          <li>We may change pricing or plan features with notice where required</li>
          <li>Failure to pay may result in suspension, downgrade, or termination</li>
        </ul>
        <p>
          You may manage billing, payment methods, invoices, plan changes, and cancellation through the billing
          portal or account settings where available.
        </p>
        <p>
          If a free trial is offered, we may limit trial availability, require payment information, change
          trial length, or end a trial if we determine it is being abused.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>13. Cancellation and Refunds</h3>
        <p>
          You may cancel your subscription through the billing portal or other cancellation method we provide.
          Cancellation will generally take effect at the end of the current billing period unless otherwise
          stated or required by law.
        </p>
        <p>
          We do not provide refunds or credits for partial months, unused time, unused features, downgraded
          plans, or failure to use the Service, unless required by law or expressly stated in writing.
        </p>
        <p>
          If you cancel, your access to paid features may continue until the end of the paid period. After
          cancellation, your account may be downgraded, restricted, or archived.
        </p>
        <p>
          We may provide self-service cancellation tools. If you experience difficulty canceling, contact us at
          the support email listed below.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>14. Taxes</h3>
        <p>
          You are responsible for any taxes, duties, levies, or governmental charges associated with your
          subscription, business activity, sales, income, payroll, projects, or use of the Service.
        </p>
        <p>
          We may calculate, collect, and remit sales tax or similar taxes where required. Tax calculations
          shown in the Service may be estimates and may not reflect your actual tax obligations.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>15. User Content and Project Data</h3>
        <p>
          &ldquo;User Content&rdquo; means information, files, text, data, images, estimates, proposals, project
          records, client records, schedules, RFIs, FARs, change orders, QC records, communications, and other
          materials you upload, enter, generate, store, send, or otherwise provide through the Service.
        </p>
        <p>
          You retain ownership of your User Content. You grant us a worldwide, non-exclusive, royalty-free
          license to host, store, process, transmit, display, reproduce, modify, and use your User Content
          solely as necessary to provide, secure, improve, support, and operate the Service.
        </p>
        <p>
          You represent and warrant that you have all rights necessary to submit and use your User Content and
          that your User Content does not violate laws, contracts, privacy rights, intellectual property
          rights, or third-party rights.
        </p>
        <p>
          You are responsible for backing up important records. While we may provide storage and export tools,
          we do not guarantee that the Service is your permanent archive or sole recordkeeping system.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>16. Confidentiality</h3>
        <p>
          You may upload or generate confidential business information through the Service. We will use
          reasonable efforts to protect your information consistent with our Privacy Policy and security
          practices.
        </p>
        <p>
          You are responsible for deciding what information to upload, share, email, export, or make available
          through public links or client portals.
        </p>
        <p>Do not upload information that you are not authorized to store or process through the Service.</p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>17. Privacy</h3>
        <p>
          Your use of the Service is also governed by our Privacy Policy. The Privacy Policy explains how we
          collect, use, disclose, and protect personal information.
        </p>
        <p>
          By using the Service, you consent to our collection and use of information as described in the
          Privacy Policy.
        </p>
        <p>
          If you collect personal information from clients, employees, subcontractors, or other third parties
          and enter it into the Service, you are responsible for providing any required notices and obtaining
          any required consents.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>18. Acceptable Use</h3>
        <p>You agree not to use the Service to:</p>
        <ul className={LEGAL_MODAL_LIST_SPACED}>
          <li>Violate any law, regulation, contract, court order, or third-party right</li>
          <li>
            Submit false, misleading, fraudulent, unlawful, defamatory, obscene, harassing, abusive, or harmful
            content
          </li>
          <li>Send spam, unsolicited commercial email, or unlawful communications</li>
          <li>Impersonate any person or entity</li>
          <li>Access another user&rsquo;s account or data without authorization</li>
          <li>Interfere with or disrupt the Service</li>
          <li>Attempt to probe, scan, test, or bypass security controls</li>
          <li>Upload malware, viruses, or harmful code</li>
          <li>Reverse engineer, decompile, copy, scrape, or misuse the Service</li>
          <li>Use automated systems to access the Service without permission</li>
          <li>Resell, sublicense, or commercially exploit the Service except as expressly allowed</li>
          <li>Use the Service to build a competing product</li>
          <li>Violate export control or sanctions laws</li>
          <li>
            Upload regulated information unless you are authorized and the Service is appropriate for that use
          </li>
        </ul>
        <p>We may suspend or terminate accounts that violate this section.</p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>19. Email and Messaging</h3>
        <p>
          The Service may allow you to send emails or messages to clients, team members, or third parties. You
          are responsible for ensuring that your messages comply with applicable laws, including anti-spam,
          privacy, and consumer protection laws.
        </p>
        <p>
          We may log email metadata such as recipient, sender, subject, template, delivery status, open
          status, click status, bounce status, and related event data where supported.
        </p>
        <p>
          We may block or limit sending to addresses that bounce, complain, unsubscribe, or appear abusive.
        </p>
        <p>
          We do not guarantee email delivery, inbox placement, open rates, response rates, or client
          acceptance.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>20. Files, Exports, and Downloads</h3>
        <p>
          The Service may allow you to export PDFs, spreadsheets, CSV files, ZIP files, proposal packages,
          accounting packages, tax packages, and other files.
        </p>
        <p>
          You are responsible for reviewing exported files before using, sending, filing, or relying on them.
        </p>
        <p>
          Exports may depend on browser settings, third-party libraries, available data, formatting
          limitations, and device capabilities. We do not guarantee that exported files will meet the
          requirements of any client, owner, accountant, government agency, software platform, or third party.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>21. Mobile, PWA, Offline, and Device Features</h3>
        <p>
          The Service may be accessible through mobile browsers, installed progressive web app features, or
          device-specific capabilities such as sharing, notifications, storage, camera, or files.
        </p>
        <p>
          Mobile and device features may depend on your device, browser, operating system, permissions,
          network connection, and third-party platforms.
        </p>
        <p>
          We do not guarantee uninterrupted mobile functionality, offline availability, push notifications,
          share previews, file access, or device-specific behavior.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>22. Beta Features and Experimental Tools</h3>
        <p>
          We may offer beta, preview, experimental, AI-assisted, or early-access features. These features may
          be incomplete, inaccurate, unstable, unavailable, or changed without notice.
        </p>
        <p>You should not rely on beta or experimental outputs without independent review.</p>
        <p>We may disable beta features at any time.</p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>23. Artificial Intelligence and Automated Suggestions</h3>
        <p>
          If the Service includes AI-assisted features, automation, suggestions, summaries, sequencing
          recommendations, proposal text, classifications, or similar tools, those outputs are generated based
          on available data and may be inaccurate, incomplete, or inappropriate for your project.
        </p>
        <p>You are responsible for reviewing and approving AI-assisted or automated outputs before use.</p>
        <p>
          We do not guarantee that AI-assisted outputs are correct, code-compliant, contract-compliant, safe,
          complete, or suitable for any bid, proposal, schedule, tax filing, or business decision.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>24. Intellectual Property</h3>
        <p>
          The Service, including software, design, user interface, workflows, templates, documentation,
          graphics, logos, trademarks, trade names, data structures, and other materials we provide, is owned
          by Concrete Calc or its licensors and is protected by intellectual property laws.
        </p>
        <p>
          You may not copy, modify, distribute, sell, lease, sublicense, reverse engineer, or create
          derivative works from the Service except as expressly allowed by these Terms.
        </p>
        <p>All rights not expressly granted are reserved.</p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>25. Feedback</h3>
        <p>
          If you provide ideas, suggestions, bug reports, feature requests, comments, designs, workflows, or
          other feedback, you grant us a perpetual, worldwide, irrevocable, royalty-free right to use, modify,
          commercialize, and incorporate that feedback without compensation or obligation to you.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>26. Publicity</h3>
        <p>
          Unless you opt out by contacting us, business customers grant us permission to use their business
          name and logo to identify them as a customer in marketing materials, customer lists, and
          presentations. We will not disclose confidential project details without permission.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>27. DMCA and Copyright Complaints</h3>
        <p>If you believe content in the Service infringes your copyright, contact us with:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Your name and contact information</li>
          <li>Identification of the copyrighted work</li>
          <li>Identification of the allegedly infringing material</li>
          <li>A statement that you have a good-faith belief the use is unauthorized</li>
          <li>A statement under penalty of perjury that the information is accurate</li>
          <li>Your physical or electronic signature</li>
        </ul>
        <p>Send notices to the contact email listed below.</p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>28. Service Availability and Changes</h3>
        <p>
          We strive to keep the Service available, but we do not guarantee uninterrupted, error-free, secure,
          or timely operation.
        </p>
        <p>
          The Service may be unavailable due to maintenance, updates, internet issues, outages, third-party
          failures, security incidents, force majeure events, or other causes.
        </p>
        <p>We may modify, suspend, restrict, or discontinue any part of the Service at any time.</p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>29. Suspension and Termination</h3>
        <p>We may suspend or terminate your access if:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>You violate these Terms</li>
          <li>You fail to pay fees</li>
          <li>Your payment method fails</li>
          <li>Your use creates risk or legal exposure</li>
          <li>Your account appears fraudulent, abusive, or insecure</li>
          <li>We are required to do so by law or third-party provider requirements</li>
          <li>We discontinue the Service or a feature</li>
        </ul>
        <p>
          You may stop using the Service at any time. Termination does not relieve you of amounts owed or
          obligations that survive termination.
        </p>
        <p>
          After termination, we may delete, retain, archive, or restrict access to account data according to
          our policies, legal obligations, backup practices, and Privacy Policy.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>30. Disclaimers</h3>
        <p>THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE.&rdquo;</p>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS, IMPLIED, STATUTORY, OR
          OTHERWISE, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE,
          NON-INFRINGEMENT, ACCURACY, RELIABILITY, AVAILABILITY, SECURITY, AND ERROR-FREE OPERATION.
        </p>
        <p>WE DO NOT WARRANT THAT:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>THE SERVICE WILL MEET YOUR REQUIREMENTS</li>
          <li>THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE</li>
          <li>ESTIMATES, SCHEDULES, REPORTS, EXPORTS, TAX SUMMARIES, OR PROPOSALS WILL BE ACCURATE</li>
          <li>DEFECTS WILL BE CORRECTED</li>
          <li>DATA WILL NEVER BE LOST</li>
          <li>EMAILS WILL BE DELIVERED</li>
          <li>THIRD-PARTY SERVICES WILL REMAIN AVAILABLE</li>
          <li>OUTPUTS WILL COMPLY WITH LAWS, CODES, CONTRACTS, TAX RULES, OR PROFESSIONAL STANDARDS</li>
        </ul>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>31. Limitation of Liability</h3>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, CONCRETE CALC AND ITS OWNERS, OFFICERS, DIRECTORS, EMPLOYEES,
          CONTRACTORS, AFFILIATES, AGENTS, SUPPLIERS, AND LICENSORS WILL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, PUNITIVE, OR SIMILAR DAMAGES, INCLUDING LOST
          PROFITS, LOST REVENUE, LOST BUSINESS, LOST DATA, LOST GOODWILL, BUSINESS INTERRUPTION, PROJECT
          DELAYS, BID LOSSES, COST OVERRUNS, TAX PENALTIES, CONTRACT DAMAGES, OR PROCUREMENT LOSSES, EVEN IF
          ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </p>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE OR
          THESE TERMS WILL NOT EXCEED THE GREATER OF:
        </p>
        <ol className="list-decimal space-y-2 pl-5 marker:text-cyan-600 dark:marker:text-cyan-400">
          <li>
            THE AMOUNT YOU PAID TO US FOR THE SERVICE IN THE THREE MONTHS BEFORE THE EVENT GIVING RISE TO THE
            CLAIM; OR
          </li>
          <li>ONE HUNDRED U.S. DOLLARS ($100).</li>
        </ol>
        <p>Some jurisdictions do not allow certain limitations, so some limitations may not apply to you.</p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>32. Indemnification</h3>
        <p>
          You agree to defend, indemnify, and hold harmless Concrete Calc and its owners, officers, directors,
          employees, contractors, affiliates, agents, suppliers, and licensors from and against all claims,
          damages, losses, liabilities, costs, and expenses, including reasonable attorneys&rsquo; fees, arising
          out of or related to:
        </p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Your use of the Service</li>
          <li>Your User Content</li>
          <li>Your estimates, proposals, schedules, exports, emails, or client communications</li>
          <li>Your construction work, contracts, bids, projects, or business operations</li>
          <li>Your tax, accounting, payroll, labor, licensing, or regulatory obligations</li>
          <li>Your violation of these Terms</li>
          <li>Your violation of law</li>
          <li>Your violation of third-party rights</li>
          <li>
            Use of the Service by your employees, clients, subcontractors, invitees, or authorized users
          </li>
        </ul>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>33. Dispute Resolution, Arbitration, and Class Action Waiver</h3>
        <p>Please review this section carefully. It may affect your legal rights.</p>
        <p>
          Before filing a claim, you agree to first contact us and attempt to resolve the dispute informally.
          You must send a written notice describing the dispute, the relief requested, and your contact
          information.
        </p>
        <p>
          If the dispute is not resolved within 30 days, either party may pursue binding arbitration as
          described below, unless an exception applies.
        </p>
        <p>
          Any dispute, claim, or controversy arising out of or relating to these Terms or the Service will be
          resolved by binding arbitration on an individual basis, rather than in court, except that either
          party may bring an individual claim in small claims court if eligible.
        </p>
        <p>
          You and Concrete Calc waive any right to a jury trial and waive any right to participate in a class
          action, class arbitration, collective action, private attorney general action, or representative
          proceeding.
        </p>
        <p>
          The arbitration will be administered by a reputable arbitration provider selected by us, unless the
          parties agree otherwise. The arbitration will be conducted in English. The arbitrator may award the
          same individual relief that a court could award, but only for the individual claim.
        </p>
        <p>
          This arbitration section does not prevent either party from seeking injunctive or equitable relief
          for misuse of intellectual property, unauthorized access, confidentiality violations, or security
          abuse.
        </p>
        <p>
          You may opt out of this arbitration agreement by sending written notice within 30 days after first
          accepting these Terms. Your opt-out notice must include your name, account email, and a statement
          that you opt out of arbitration.
        </p>
        <p>If this arbitration section is found unenforceable, the remainder of the Terms will remain in effect.</p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>34. Governing Law and Venue</h3>
        <p>
          These Terms are governed by the laws of the State of California, without regard to conflict-of-law
          rules, unless applicable law requires otherwise.
        </p>
        <p>
          Subject to the arbitration section, any court proceeding must be brought in the state or federal
          courts located in California, and you consent to personal jurisdiction and venue there.
        </p>
        <p>
          If your company is not based in California or you prefer another state, update this section before
          publishing.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>35. Export Control and Sanctions</h3>
        <p>
          You may not use the Service if you are located in, organized under the laws of, or ordinarily
          resident in a country or region subject to comprehensive U.S. sanctions, or if you are listed on any
          U.S. government restricted-party list.
        </p>
        <p>
          You agree not to use, export, re-export, or transfer the Service in violation of U.S. export control
          or sanctions laws.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>36. Government Use</h3>
        <p>
          The Service is commercial computer software. If used by or on behalf of a government entity, the
          Service is provided with only the rights granted to other users under these Terms, unless a separate
          written agreement states otherwise.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>37. Changes to These Terms</h3>
        <p>
          We may update these Terms from time to time. If changes are material, we will provide notice by email,
          in-app notice, or other reasonable means.
        </p>
        <p>
          The updated Terms will be effective on the date stated in the notice or posted version. Your continued
          use of the Service after the effective date means you accept the updated Terms.
        </p>
        <p>
          If you do not agree to the updated Terms, you must stop using the Service and cancel any paid
          subscription.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>38. Assignment</h3>
        <p>
          You may not assign or transfer these Terms or your account without our prior written consent.
        </p>
        <p>
          We may assign these Terms in connection with a merger, acquisition, financing, reorganization, sale
          of assets, change of control, or operation of law.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>39. Severability</h3>
        <p>
          If any provision of these Terms is found invalid, illegal, or unenforceable, that provision will be
          modified to the minimum extent necessary to make it enforceable, or removed if modification is not
          possible. The remaining provisions will remain in full force and effect.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>40. No Waiver</h3>
        <p>
          Our failure to enforce any provision of these Terms does not waive our right to enforce that
          provision later.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>41. Entire Agreement</h3>
        <p>
          These Terms, together with the Privacy Policy, any applicable order form, subscription terms, plan
          terms, or written agreement between you and us, make up the entire agreement between you and Concrete
          Calc regarding the Service.
        </p>
        <p>
          If there is a conflict between these Terms and a separate written agreement signed by both parties,
          the signed agreement controls to the extent of the conflict.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>42. Contact Information</h3>
        <p>If you have questions about these Terms, contact us at:</p>
        <address className="not-italic mt-2 space-y-1">
          <p>
            <strong>ConcreteCalc, LLC</strong>
          </p>
          <p>
            Email:{' '}
            <a href="mailto:support@concrete-calc.com" className={LEGAL_MODAL_LINK}>
              support@concrete-calc.com
            </a>
          </p>
          <p>
            <strong>Address:</strong> [Insert Legal Business Mailing Address]
          </p>
        </address>
        <p className={LEGAL_MODAL_META}>
          Do not publish a placeholder address. Use your actual legal business mailing address or registered
          business address before making these Terms public.
        </p>
      </section>
    </div>
  );
};

export default TermsOfService;
