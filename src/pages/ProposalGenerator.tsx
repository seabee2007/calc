import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Save, Edit, ArrowLeft, Printer, Download, Mail, FileText, Plus, X, Upload } from 'lucide-react';
import { ProposalData } from '../types/proposal';
import { ProposalService, SavedProposal } from '../lib/proposalService';
import ProposalTemplateClassic from '../components/proposals/ProposalTemplateClassic';
import ProposalTemplateModern from '../components/proposals/ProposalTemplateModern';
import ProposalTemplateMinimal from '../components/proposals/ProposalTemplateMinimal';
import Button from '../components/ui/Button';
import { generateProposalPDF } from '../utils/pdf';
import { useSettingsStore } from '../store';
import { useProjectStore } from '../store';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { formatPrice } from '../utils/pricing';
import { soundService } from '../services/soundService';

type TemplateType = 'classic' | 'modern' | 'minimal';

const ProposalGenerator: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editId = searchParams.get('edit');
  const previewId = searchParams.get('preview');
  const isEditing = !!editId;
  const isPreviewMode = !!previewId;
  const { companySettings } = useSettingsStore();
  const { projects } = useProjectStore();
  const location = useLocation();
  
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('classic');
  const [showPreview, setShowPreview] = useState(isPreviewMode);
  const [currentProposal, setCurrentProposal] = useState<SavedProposal | null>(null);
  const [proposalTitle, setProposalTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  const [proposalData, setProposalData] = useState<ProposalData>({
    businessName: companySettings.companyName || '',
    businessLogoUrl: companySettings.logo || '',
    businessAddress: companySettings.address || '',
    businessPhone: companySettings.phone || '',
    businessEmail: companySettings.email || '',
    businessLicenseNumber: companySettings.licenseNumber || '',
    businessSlogan: companySettings.motto || '',
    clientName: '',
    clientCompany: '',
    clientAddress: '',
    projectTitle: '',
    date: new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    introduction: '',
    scope: '',
    timeline: [
      { phase: '', start: '', end: '' },
    ],
    pricing: [
      { description: '', amount: '' },
    ],
    terms: '',
    preparedBy: '',
    preparedByTitle: '',
  });

  // Load proposal data when editing or previewing
  useEffect(() => {
    const loadProposal = async () => {
      const id = editId || previewId;
      if (!id) return;

      try {
        setLoading(true);
        const proposal = await ProposalService.getById(id);
        setCurrentProposal(proposal);
        setProposalData(proposal.data);
        setSelectedTemplate(proposal.template_type);
        setProposalTitle(proposal.title);
        
        if (previewId) {
          setShowPreview(true);
        }
      } catch (error) {
        console.error('Failed to load proposal:', error);
        navigate('/proposals');
      } finally {
        setLoading(false);
      }
    };

    loadProposal();
  }, [editId, previewId, navigate]);

  // Handle project data from navigation state
  useEffect(() => {
    const state = location.state as { projectName?: string; projectDescription?: string };
    if (state?.projectName && !isEditing && !isPreviewMode) {
      // Pre-fill proposal data with project information
      setProposalTitle(`${state.projectName} - Concrete Proposal`);
      setProposalData(prev => ({
        ...prev,
        projectTitle: state.projectName || '',
        introduction: state.projectDescription 
          ? `We are pleased to submit this proposal for your ${state.projectName} project. ${state.projectDescription}`
          : `We are pleased to submit this proposal for your ${state.projectName || 'concrete'} project.`,
        scope: `This proposal covers all concrete work required for the ${state.projectName || 'concrete'} project, including materials, labor, and related services.`
      }));
      
      // Clear the navigation state to prevent re-applying on subsequent renders
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }
  }, [location.state, isEditing, isPreviewMode]);

  // Import pricing from selected project
  const importPricingFromProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !project.calculations?.length) {
      alert('Selected project has no calculations with pricing data.');
      return;
    }

    console.log('🔍 Importing from project:', project.name);
    console.log('📊 Available calculations:', project.calculations);

    // Filter to only calculations that have pricing data
    const calculationsWithPricing = project.calculations.filter(calc => {
      const pricing = (calc.result as any).pricing;
      return pricing && pricing.concreteCost > 0;
    });

    console.log('💎 Calculations with pricing:', calculationsWithPricing);

    if (calculationsWithPricing.length === 0) {
      alert('No calculations with pricing data found in this project. Please ensure you have calculated pricing for at least one calculation.');
      return;
    }
    
    // Consolidation objects
    const concreteByPsi: { [psi: string]: { volume: number; cost: number; calcTypes: string[] } } = {};
    let totalDeliveryFees = 0;
    const additionalServicesCosts: { [service: string]: number } = {};
    
    calculationsWithPricing.forEach((calc, index) => {
      console.log(`📋 Processing calculation ${index + 1}:`, calc);
      
      const volume = calc.result.volume;
      const calcType = calc.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      const psi = (calc as any).psi || '3000';
      const pricing = (calc.result as any).pricing;
      
      console.log(`🔧 Processing:`, { volume, calcType, psi, pricing });
      
      // Consolidate concrete by PSI
      if (pricing?.concreteCost > 0) {
        if (!concreteByPsi[psi]) {
          concreteByPsi[psi] = { volume: 0, cost: 0, calcTypes: [] };
        }
        concreteByPsi[psi].volume += volume;
        concreteByPsi[psi].cost += pricing.concreteCost;
        if (!concreteByPsi[psi].calcTypes.includes(calcType)) {
          concreteByPsi[psi].calcTypes.push(calcType);
        }
      }

      // Consolidate delivery fees
      if (pricing?.deliveryFees?.totalDeliveryFees > 0) {
        totalDeliveryFees += pricing.deliveryFees.totalDeliveryFees;
      }

      // Consolidate additional services
      if (pricing?.additionalServices) {
        if (pricing.additionalServices.pumpTruckFee > 0) {
          additionalServicesCosts['Pump Truck'] = (additionalServicesCosts['Pump Truck'] || 0) + pricing.additionalServices.pumpTruckFee;
        }
        if (pricing.additionalServices.saturdayFee > 0) {
          additionalServicesCosts['Saturday Delivery'] = (additionalServicesCosts['Saturday Delivery'] || 0) + pricing.additionalServices.saturdayFee;
        }
        if (pricing.additionalServices.afterHoursFee > 0) {
          additionalServicesCosts['After Hours Delivery'] = (additionalServicesCosts['After Hours Delivery'] || 0) + pricing.additionalServices.afterHoursFee;
        }
      }
    });

    // Build consolidated pricing items
    const pricingItems: { description: string; amount: string }[] = [];

    // Add consolidated concrete items
    Object.entries(concreteByPsi).forEach(([psi, data]) => {
      const calcTypesStr = data.calcTypes.length === 1 
        ? data.calcTypes[0] 
        : data.calcTypes.length === 2 
          ? data.calcTypes.join(' & ')
          : 'Mixed Concrete Work';
          
      pricingItems.push({
        description: `${calcTypesStr} - ${data.volume.toFixed(2)} yd³ concrete (${psi} PSI)`,
        amount: formatPrice(data.cost)
      });
    });

    // Add consolidated delivery fees
    if (totalDeliveryFees > 0) {
      pricingItems.push({
        description: 'Delivery & Transportation',
        amount: formatPrice(totalDeliveryFees)
      });
    }

    // Add consolidated additional services
    Object.entries(additionalServicesCosts).forEach(([service, cost]) => {
      pricingItems.push({
        description: service,
        amount: formatPrice(cost)
      });
    });

    console.log('📝 Consolidated pricing items:', pricingItems);
    console.log('🧮 Consolidation summary:', {
      concreteByPsi,
      totalDeliveryFees,
      additionalServicesCosts
    });

    if (pricingItems.length === 0) {
      alert('No pricing data could be extracted from the selected project.');
      return;
    }

    // Update proposal pricing with imported data
    setProposalData(prev => ({
      ...prev,
      pricing: pricingItems,
      projectTitle: prev.projectTitle || `${project.name} Concrete Work`
    }));

    setShowProjectPicker(false);
    alert(`Successfully imported ${pricingItems.length} consolidated pricing items from "${project.name}"`);
  };

  // Update proposal data when company settings change (for new proposals)
  useEffect(() => {
    if (!isEditing) {
      setProposalData(prev => ({
        ...prev,
        businessName: companySettings.companyName || prev.businessName,
        businessLogoUrl: companySettings.logo || prev.businessLogoUrl,
        businessAddress: companySettings.address || prev.businessAddress,
        businessPhone: companySettings.phone || prev.businessPhone,
        businessEmail: companySettings.email || prev.businessEmail,
        businessLicenseNumber: companySettings.licenseNumber || prev.businessLicenseNumber,
        businessSlogan: companySettings.motto || prev.businessSlogan,
      }));
    }
  }, [companySettings, isEditing]);

  // Save proposal function
  const handleSave = async () => {
    if (!proposalTitle.trim()) {
      alert('Please enter a proposal title');
      return;
    }

    try {
      setSaving(true);
      
      if (isEditing && currentProposal) {
        // Update existing proposal
        await ProposalService.update(currentProposal.id, {
          title: proposalTitle,
          template_type: selectedTemplate,
          data: proposalData,
        });
        alert('Proposal updated successfully!');
      } else {
        // Create new proposal
        const savedProposal = await ProposalService.create({
          title: proposalTitle,
          template_type: selectedTemplate,
          data: proposalData,
        });
        setCurrentProposal(savedProposal);
        alert('Proposal saved successfully!');
        
        // Update URL to edit mode
        navigate(`/proposal-generator?edit=${savedProposal.id}`, { replace: true });
      }
    } catch (error) {
      console.error('Failed to save proposal:', error);
      alert('Failed to save proposal. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Auto-generate title from project data
  const generateTitle = () => {
    const parts = [];
    if (proposalData.projectTitle) parts.push(proposalData.projectTitle);
    if (proposalData.clientName) parts.push(`for ${proposalData.clientName}`);
    
    const generated = parts.length > 0 
      ? parts.join(' ') 
      : `Proposal - ${new Date().toLocaleDateString()}`;
    
    setProposalTitle(generated);
  };

  const handleInputChange = (field: keyof ProposalData, value: string) => {
    setProposalData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTimelineChange = (index: number, field: keyof ProposalData['timeline'][0], value: string) => {
    setProposalData(prev => ({
      ...prev,
      timeline: prev.timeline.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handlePricingChange = (index: number, field: keyof ProposalData['pricing'][0], value: string) => {
    setProposalData(prev => ({
      ...prev,
      pricing: prev.pricing.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const formatCurrency = (value: string): string => {
    // Remove all non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');
    
    // Handle empty input
    if (!numericValue) return '';
    
    // Ensure only one decimal point
    const parts = numericValue.split('.');
    let cleanValue = parts[0];
    if (parts.length > 1) {
      // Limit to 2 decimal places
      cleanValue += '.' + parts[1].substring(0, 2);
    }
    
    // Parse to number and format as currency
    const number = parseFloat(cleanValue);
    if (isNaN(number)) return '';
    
    return number.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handleAmountBlur = (index: number, value: string) => {
    // Format as currency when user finishes editing
    const formatted = formatCurrency(value);
    if (formatted) {
      setProposalData(prev => ({
        ...prev,
        pricing: prev.pricing.map((item, i) => 
          i === index ? { ...item, amount: formatted } : item
        )
      }));
    }
  };

  const handleAmountFocus = (index: number, value: string) => {
    // Remove formatting for easier editing
    if (value.startsWith('$')) {
      const numericValue = value.replace(/[^0-9.]/g, '');
      setProposalData(prev => ({
        ...prev,
        pricing: prev.pricing.map((item, i) => 
          i === index ? { ...item, amount: numericValue } : item
        )
      }));
    }
  };

  const handlePhoneChange = (value: string) => {
    // Remove all non-numeric characters
    const numericValue = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    let formattedValue = numericValue;
    if (numericValue.length >= 6) {
      formattedValue = `(${numericValue.slice(0, 3)}) ${numericValue.slice(3, 6)}-${numericValue.slice(6, 10)}`;
    } else if (numericValue.length >= 3) {
      formattedValue = `(${numericValue.slice(0, 3)}) ${numericValue.slice(3)}`;
    }
    
    handleInputChange('businessPhone', formattedValue);
  };

  const addTimelineItem = () => {
    setProposalData(prev => ({
      ...prev,
      timeline: [...prev.timeline, { phase: '', start: '', end: '' }]
    }));
  };

  const addPricingItem = () => {
    setProposalData(prev => ({
      ...prev,
      pricing: [...prev.pricing, { description: '', amount: '' }]
    }));
  };

  const removeTimelineItem = (index: number) => {
    soundService.play('trash');
    setProposalData(prev => ({
      ...prev,
      timeline: prev.timeline.filter((_, i) => i !== index)
    }));
  };

  const removePricingItem = (index: number) => {
    soundService.play('trash');
    setProposalData(prev => ({
      ...prev,
      pricing: prev.pricing.filter((_, i) => i !== index)
    }));
  };

  const handlePrint = () => {
    if (!printRef.current) {
      alert('Preview not ready for printing. Please try again in a moment.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // More user-friendly message since we have download option
      alert('Pop-ups are blocked. Please use the Download PDF button instead, or enable pop-ups and try again.');
      return;
    }

    const printContent = printRef.current.innerHTML;
    const title = `${proposalData.projectTitle || 'Proposal'} - ${proposalData.businessName || 'Concrete Proposal'}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            * { box-sizing: border-box; }
            body { 
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              margin: 0; 
              padding: 20px; 
              color: #374151;
              line-height: 1.6;
              font-size: 14px;
            }
            
            /* Layout & Containers */
            .max-w-3xl { max-width: 48rem; margin: 0 auto; }
            .bg-white { background-color: #ffffff; }
            .shadow-lg, .shadow-xl { box-shadow: none !important; }
            .rounded-lg { border-radius: 0 !important; }
            
            /* Typography */
            .text-2xl { font-size: 1.5rem; line-height: 2rem; }
            .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
            .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
            .text-base { font-size: 1rem; line-height: 1.5rem; }
            .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
            .text-xs { font-size: 0.75rem; line-height: 1rem; }
            .text-md { font-size: 1rem; line-height: 1.5rem; }
            
            .font-bold { font-weight: 700; }
            .font-semibold { font-weight: 600; }
            .font-medium { font-weight: 500; }
            
            /* Colors */
            .text-gray-500 { color: #6b7280; }
            .text-gray-600 { color: #4b5563; }
            .text-gray-700 { color: #374151; }
            .text-gray-800 { color: #1f2937; }
            .text-indigo-600 { color: #4f46e5; }
            
            /* Spacing */
            .p-8 { padding: 2rem; }
            .p-6 { padding: 1.5rem; }
            .p-4 { padding: 1rem; }
            .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
            .px-4 { padding-left: 1rem; padding-right: 1rem; }
            .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
            
            .mb-8 { margin-bottom: 2rem; }
            .mb-6 { margin-bottom: 1.5rem; }
            .mb-4 { margin-bottom: 1rem; }
            .mb-3 { margin-bottom: 0.75rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .mb-1 { margin-bottom: 0.25rem; }
            .mt-12 { margin-top: 3rem; }
            .mt-8 { margin-top: 2rem; }
            .mt-1 { margin-top: 0.25rem; }
            .my-8 { margin-top: 2rem; margin-bottom: 2rem; }
            
            .space-x-4 > * + * { margin-left: 1rem; }
            .space-y-3 > * + * { margin-top: 0.75rem; }
            
            /* Flexbox */
            .flex { display: flex; }
            .items-center { align-items: center; }
            .justify-between { justify-content: space-between; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .text-justify { text-align: justify; }
            
            /* Grid */
            .grid { display: grid; }
            .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
            .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .gap-8 { gap: 2rem; }
            .gap-6 { gap: 1.5rem; }
            
            /* Tables */
            .min-w-full { min-width: 100%; }
            .overflow-x-auto { overflow-x: auto; }
            table { 
              border-collapse: collapse; 
              width: 100%; 
              border: 1px solid #e5e7eb;
              background-color: #ffffff;
            }
            
            th, td { 
              border: 1px solid #e5e7eb; 
              padding: 0.5rem 1rem; 
              text-align: left; 
              vertical-align: top;
            }
            
            th { 
              background-color: #f3f4f6 !important; 
              font-weight: 600; 
              color: #374151;
            }
            
            .border { border: 1px solid #e5e7eb; }
            .border-gray-200 { border-color: #e5e7eb; }
            .border-gray-300 { border-color: #d1d5db; }
            .border-b { border-bottom: 1px solid #e5e7eb; }
            .border-b-2 { border-bottom: 2px solid #e5e7eb; }
            .border-dashed { border-style: dashed; }
            
            /* Backgrounds */
            .bg-gray-50 { background-color: #f9fafb; }
            .bg-gray-100 { background-color: #f3f4f6; }
            .bg-blue-50 { background-color: #eff6ff; }
            .bg-indigo-50 { background-color: #eef2ff; }
            
            /* Lists */
            ul { list-style: none; padding: 0; margin: 0; }
            li { margin: 0; }
            
            /* Horizontal Rules */
            hr { 
              border: 0; 
              height: 1px; 
              background: #d1d5db; 
              margin: 1rem 0; 
            }
            
            /* Images */
            img { max-width: 100%; height: auto; }
            .h-16 { height: 4rem; }
            .h-12 { height: 3rem; }
            .w-auto { width: auto; }
            
            /* Text Utilities */
            .leading-relaxed { line-height: 1.625; }
            .whitespace-pre-line { white-space: pre-line; }
            
            /* Print-specific overrides */
            @media print {
              body { padding: 0; margin: 0; }
              .shadow-lg, .shadow-xl { box-shadow: none !important; }
              .rounded-lg { border-radius: 0 !important; }
              
              /* Force table borders and backgrounds to print */
              table, th, td { 
                border: 1px solid #000 !important; 
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              
              th { 
                background-color: #f3f4f6 !important; 
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              
              .bg-gray-50, .bg-gray-100 { 
                background-color: #f9fafb !important; 
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              
              /* Ensure grid layouts work in print */
              .grid-cols-2 { 
                display: grid !important;
                grid-template-columns: 1fr 1fr !important;
              }
              
              /* Force borders to show */
              .border, .border-gray-200, .border-gray-300 {
                border: 1px solid #000 !important;
              }
              
              .border-b, .border-b-2 {
                border-bottom: 1px solid #000 !important;
              }
            }
            
            /* Specific fixes for cards and containers */
            .bg-gray-50.p-4.rounded-lg.border {
              background-color: #f9fafb !important;
              border: 1px solid #e5e7eb !important;
              padding: 1rem !important;
              margin-bottom: 1rem;
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);

    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) {
      alert('Preview not ready for download. Please try again in a moment.');
      return;
    }

    try {
      const title = `${proposalData.projectTitle || 'Proposal'} - ${proposalData.businessName || 'Concrete Proposal'}`;
      const htmlContent = printRef.current.innerHTML;
      
      await generateProposalPDF(htmlContent, title, undefined, selectedTemplate, proposalData);
      console.log('Proposal PDF generated successfully');
    } catch (error) {
      console.error('Error generating proposal PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handleEmailProposal = async () => {
    if (!printRef.current) {
      alert('Preview not ready for email. Please try again in a moment.');
      return;
    }

    try {
      const title = `${proposalData.projectTitle || 'Proposal'} - ${proposalData.businessName || 'Concrete Proposal'}`;
      const htmlContent = printRef.current.innerHTML;
      
      // Generate the PDF first
      await generateProposalPDF(htmlContent, title, undefined, selectedTemplate, proposalData);
      
      // If we're in a Capacitor environment (mobile app), the PDF will be shared via native share sheet
      // Otherwise, for web, we'll fall back to mailto link
      if (!('Capacitor' in window)) {
        const subject = encodeURIComponent(`Concrete Proposal - ${proposalData.projectTitle || 'Project'}`);
        const body = encodeURIComponent(`
Please find attached our concrete proposal for your project.

Project: ${proposalData.projectTitle || 'Project'}
Client: ${proposalData.clientName || 'Client Name'}
Business: ${proposalData.businessName || 'Your Business Name'}

${proposalData.introduction || 'Please see the attached proposal for full details.'}

Best regards,
${proposalData.preparedBy || 'Your Name'}
${proposalData.preparedByTitle || ''}
        `);
        
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      }
    } catch (error) {
      console.error('Error preparing proposal for email:', error);
      alert('Failed to prepare proposal for email. Please try again.');
    }
  };

  const getDisplayValue = (value: string | undefined, placeholder: string): string => {
    return value || placeholder;
  };

  const renderTemplate = () => {
    const calculatedTotal = calculateTotal();
    
    const displayData: ProposalData = {
      ...proposalData,
      businessName: getDisplayValue(proposalData.businessName, 'Your Business Name'),
      businessAddress: getDisplayValue(proposalData.businessAddress, '123 Main St, Your City, State ZIP'),
      clientName: getDisplayValue(proposalData.clientName, 'Client Name'),
      clientCompany: getDisplayValue(proposalData.clientCompany, 'Client Company'),
      clientAddress: getDisplayValue(proposalData.clientAddress, '456 Client St, Client City, State ZIP'),
      projectTitle: getDisplayValue(proposalData.projectTitle, 'Project Title'),
      introduction: getDisplayValue(proposalData.introduction, 'Thank you for considering our concrete services for your project. We specialize in high-strength, durable mixes designed for commercial and residential applications.'),
      scope: getDisplayValue(proposalData.scope, 'Supply and place ready-mix concrete, including all forms, vapor barriers, reinforcement placement, slump testing, and finishing to ACI standards.'),
      timeline: proposalData.timeline.map(item => ({
        phase: getDisplayValue(item.phase, 'Project Phase'),
        start: getDisplayValue(item.start, 'Start Date'),
        end: getDisplayValue(item.end, 'End Date'),
      })),
      pricing: proposalData.pricing.map(item => ({
        description: getDisplayValue(item.description, 'Service Description'),
        amount: getDisplayValue(item.amount, '$0.00'),
      })),
      terms: getDisplayValue(proposalData.terms, 'A 50% deposit is due upon acceptance of this proposal. Final payment is due upon completion. All work performed in accordance with ACI standards and local building codes. Warranty: 1 year against workmanship defects.'),
      preparedBy: getDisplayValue(proposalData.preparedBy, 'Your Name'),
      preparedByTitle: getDisplayValue(proposalData.preparedByTitle, 'Project Manager'),
    };

    const templateProps = {
      data: displayData,
      total: formatTotal(calculatedTotal)
    };

    switch (selectedTemplate) {
      case 'classic':
        return <ProposalTemplateClassic {...templateProps} />;
      case 'modern':
        return <ProposalTemplateModern {...templateProps} />;
      case 'minimal':
        return <ProposalTemplateMinimal {...templateProps} />;
      default:
        return <ProposalTemplateClassic {...templateProps} />;
    }
  };

  const templatePreviews = {
    classic: {
      name: 'Classic Professional',
      description: 'Traditional business proposal with formal tables and clean layout',
      color: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
    },
    modern: {
      name: 'Modern One-Pager',
      description: 'Contemporary design with cards and two-column layout',
      color: 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800'
    },
    minimal: {
      name: 'Minimalist Executive',
      description: 'Clean, simple design focused on essential information',
      color: 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
    }
  };

  // Calculate total from pricing items
  const calculateTotal = () => {
    return proposalData.pricing.reduce((total, item) => {
      if (!item.amount) return total;
      
      // Remove currency symbols and formatting, then parse as number
      const numericValue = item.amount.replace(/[^0-9.-]/g, '');
      const amount = parseFloat(numericValue) || 0;
      return total + amount;
    }, 0);
  };

  const formatTotal = (total: number) => {
    return total.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  if (showPreview) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8">
        <div className="max-w-5xl mx-auto px-4">
          {/* Preview Header */}
          <div className="mb-6">
            {/* Title - Full Width */}
            <div className="mb-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white w-full">
                Proposal Preview
              </h1>
            </div>
            
            {/* Proposal Details */}
            <div className="mb-4">
              <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 mb-2">
                Proposal - {new Date().toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                {templatePreviews[selectedTemplate].name} Professional
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              {isPreviewMode && (
                <Button
                  variant="outline"
                  onClick={() => navigate('/proposals')}
                  icon={<ArrowLeft size={18} />}
                  className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span className="hidden md:inline">Back to Proposals</span>
                </Button>
              )}
              {isPreviewMode && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/proposal-generator?edit=${previewId}`)}
                  icon={<Edit size={18} />}
                  className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span className="hidden md:inline">Edit</span>
                </Button>
              )}
              {!isPreviewMode && (
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(false)}
                  icon={<ArrowLeft size={18} />}
                  className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span className="hidden md:inline">Back to Editor</span>
                </Button>
              )}
              <Button
                onClick={handleEmailProposal}
                icon={<Mail size={18} />}
                variant="outline"
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <span className="hidden md:inline">Email</span>
              </Button>
              <Button
                onClick={handleDownloadPDF}
                icon={<Download size={18} />}
                className="bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 text-white"
              >
                <span className="hidden md:inline">Download PDF</span>
              </Button>
            </div>
          </div>

          {/* Template Preview */}
          <div ref={printRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden print:shadow-none print:rounded-none print:bg-white">
            {renderTemplate()}
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading proposal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {isEditing ? 'Edit Proposal' : 'Proposal Generator'}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {isEditing 
              ? `Editing: ${currentProposal?.title || 'Untitled Proposal'}`
              : 'Create professional concrete project proposals with customizable templates'
            }
          </p>
          <div className="mt-4 flex justify-center gap-3">
            {isEditing ? (
              <Button
                variant="outline"
                onClick={() => navigate('/proposals')}
                icon={<ArrowLeft size={18} />}
                size="sm"
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Back to Proposals
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  // Check if user has made any changes
                  const hasChanges = proposalData.businessName || proposalData.clientName || 
                                   proposalData.projectTitle || proposalData.introduction || 
                                   proposalData.scope || proposalTitle;
                  
                  if (hasChanges) {
                    const confirmed = window.confirm(
                      'Are you sure you want to cancel? Any unsaved changes will be lost.'
                    );
                    if (!confirmed) return;
                  }
                  
                  navigate('/proposals');
                }}
                icon={<ArrowLeft size={18} />}
                size="sm"
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </Button>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Proposal Title & Save */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Proposal Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proposal Title</label>
                  <input
                    type="text"
                    placeholder="Enter proposal title"
                    value={proposalTitle}
                    onChange={(e) => setProposalTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
                <div className="md:col-span-1 flex items-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={generateTitle}
                    size="sm"
                    className="whitespace-nowrap border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Auto Generate
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving || !proposalTitle.trim()}
                    icon={<Save size={18} />}
                    className="whitespace-nowrap bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : (isEditing ? 'Update' : 'Save')}
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Template Selection */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Choose Template</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(templatePreviews).map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedTemplate(key as TemplateType)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedTemplate === key
                        ? `${template.color} border-current`
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <h3 className="font-semibold text-sm mb-1 text-gray-900 dark:text-white">{template.name}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300">{template.description}</p>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Business Information */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Business Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Name</label>
                  <input
                    type="text"
                    placeholder="Your Business Name"
                    value={proposalData.businessName}
                    onChange={(e) => handleInputChange('businessName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo URL (optional)</label>
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={proposalData.businessLogoUrl || ''}
                    onChange={(e) => handleInputChange('businessLogoUrl', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Address</label>
                  <input
                    type="text"
                    placeholder="123 Main St, Your City, State ZIP"
                    value={proposalData.businessAddress || ''}
                    onChange={(e) => handleInputChange('businessAddress', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={proposalData.businessPhone || ''}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    inputMode="numeric"
                    pattern="[0-9\s\(\)\-]*"
                    maxLength={14}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="contact@company.com"
                    value={proposalData.businessEmail || ''}
                    onChange={(e) => handleInputChange('businessEmail', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">License Number</label>
                  <input
                    type="text"
                    placeholder="License #12345"
                    value={proposalData.businessLicenseNumber || ''}
                    onChange={(e) => handleInputChange('businessLicenseNumber', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Slogan</label>
                  <input
                    type="text"
                    placeholder="Building Excellence, One Project at a Time"
                    value={proposalData.businessSlogan || ''}
                    onChange={(e) => handleInputChange('businessSlogan', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
              </div>
            </motion.div>

            {/* Client Information */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Client Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client Name</label>
                  <input
                    type="text"
                    placeholder="Client Name"
                    value={proposalData.clientName}
                    onChange={(e) => handleInputChange('clientName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client Company (optional)</label>
                  <input
                    type="text"
                    placeholder="Client Company"
                    value={proposalData.clientCompany || ''}
                    onChange={(e) => handleInputChange('clientCompany', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client Address (optional)</label>
                  <input
                    type="text"
                    placeholder="456 Client St, Client City, State ZIP"
                    value={proposalData.clientAddress || ''}
                    onChange={(e) => handleInputChange('clientAddress', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
              </div>
            </motion.div>

            {/* Project Details */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Project Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Title</label>
                  <input
                    type="text"
                    placeholder="Project Title"
                    value={proposalData.projectTitle}
                    onChange={(e) => handleInputChange('projectTitle', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                  <input
                    type="text"
                    placeholder="Today's Date"
                    value={proposalData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Introduction</label>
                  <textarea
                    placeholder="Thank you for considering our concrete services for your project. We specialize in high-strength, durable mixes designed for commercial and residential applications."
                    value={proposalData.introduction}
                    onChange={(e) => handleInputChange('introduction', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scope of Work</label>
                  <textarea
                    placeholder="Supply and place ready-mix concrete, including all forms, vapor barriers, reinforcement placement, slump testing, and finishing to ACI standards."
                    value={proposalData.scope}
                    onChange={(e) => handleInputChange('scope', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
              </div>
            </motion.div>

            {/* Timeline */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Project Timeline</h2>
                <button
                  onClick={addTimelineItem}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                >
                  + Add Phase
                </button>
              </div>
              <div className="space-y-3">
                {proposalData.timeline.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phase</label>
                      <input
                        type="text"
                        placeholder="Project Phase"
                        value={item.phase}
                        onChange={(e) => handleTimelineChange(index, 'phase', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                      <input
                        type="date"
                        placeholder="Start Date"
                        value={item.start}
                        onChange={(e) => handleTimelineChange(index, 'start', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                      <input
                        type="date"
                        placeholder="End Date"
                        value={item.end}
                        onChange={(e) => handleTimelineChange(index, 'end', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      />
                    </div>
                    <button
                      onClick={() => removeTimelineItem(index)}
                      className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Pricing */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Pricing</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowProjectPicker(true)}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <Upload size={14} />
                    <span className="hidden sm:inline">Import from Project</span>
                    <span className="sm:hidden">Import</span>
                  </button>
                  <button
                    onClick={addPricingItem}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                  >
                    <span className="hidden sm:inline">+ Add Item</span>
                    <span className="sm:hidden">+ Add</span>
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {proposalData.pricing.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                      <input
                        type="text"
                        placeholder="Service Description"
                        value={item.description}
                        onChange={(e) => handlePricingChange(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                      <input
                        type="text"
                        placeholder="$0.00"
                        value={item.amount}
                        onChange={(e) => handlePricingChange(index, 'amount', e.target.value)}
                        onBlur={(e) => handleAmountBlur(index, e.target.value)}
                        onFocus={(e) => handleAmountFocus(index, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        inputMode="decimal"
                        pattern="[0-9]*"
                      />
                    </div>
                    <button
                      onClick={() => removePricingItem(index)}
                      className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              
              {/* Total Pricing */}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">Total Cost</span>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {formatTotal(calculateTotal())}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Terms & Footer */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Terms & Footer</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Terms & Conditions</label>
                  <textarea
                    placeholder="A 50% deposit is due upon acceptance of this proposal. Final payment is due upon completion. All work performed in accordance with ACI standards and local building codes. Warranty: 1 year against workmanship defects."
                    value={proposalData.terms}
                    onChange={(e) => handleInputChange('terms', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prepared By</label>
                    <input
                      type="text"
                      placeholder="Your Name"
                      value={proposalData.preparedBy}
                      onChange={(e) => handleInputChange('preparedBy', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title (optional)</label>
                    <input
                      type="text"
                      placeholder="Project Manager"
                      value={proposalData.preparedByTitle || ''}
                      onChange={(e) => handleInputChange('preparedByTitle', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Preview Section */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 sticky top-8"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Preview</h2>
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <p className="text-sm mb-2">Template: {templatePreviews[selectedTemplate].name}</p>
                    <p className="text-xs">{templatePreviews[selectedTemplate].description}</p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowPreview(true)}
                  className="w-full px-4 py-3 bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  📄 Preview Proposal
                </button>
                
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <p>• Fill out the form to customize your proposal</p>
                  <p>• Choose from 3 professional templates</p>
                  <p>• Preview and print/export as PDF</p>
                  <p>• Placeholder text disappears when typing</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Project Picker Modal */}
      {showProjectPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Import Pricing from Project
              </h3>
              <button
                onClick={() => setShowProjectPicker(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select a project to import its calculation pricing data into this proposal.
              </p>
              
              {projects.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No projects found</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Create projects with calculations to import pricing data.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:border-blue-300 dark:hover:border-blue-500 cursor-pointer"
                      onClick={() => importPricingFromProject(project.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {project.name}
                          </h4>
                          {project.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {project.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{project.calculations?.length || 0} calculations</span>
                            <span>
                              {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'No date'}
                            </span>
                          </div>
                        </div>
                        <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                          <Upload size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={() => setShowProjectPicker(false)}
                className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProposalGenerator; 