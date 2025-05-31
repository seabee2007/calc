import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Save, Edit, ArrowLeft } from 'lucide-react';
import { ProposalData } from '../types/proposal';
import { ProposalService, SavedProposal } from '../lib/proposalService';
import ProposalTemplateClassic from '../components/proposals/ProposalTemplateClassic';
import ProposalTemplateModern from '../components/proposals/ProposalTemplateModern';
import ProposalTemplateMinimal from '../components/proposals/ProposalTemplateMinimal';
import Button from '../components/ui/Button';

type TemplateType = 'classic' | 'modern' | 'minimal';

const ProposalGenerator: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editId = searchParams.get('edit');
  const previewId = searchParams.get('preview');
  const isEditing = !!editId;
  const isPreviewMode = !!previewId;
  
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('classic');
  const [showPreview, setShowPreview] = useState(isPreviewMode);
  const [currentProposal, setCurrentProposal] = useState<SavedProposal | null>(null);
  const [proposalTitle, setProposalTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const [proposalData, setProposalData] = useState<ProposalData>({
    businessName: '',
    businessLogoUrl: '',
    businessAddress: '',
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
      { phase: '', start: '', end: '' },
      { phase: '', start: '', end: '' },
      { phase: '', start: '', end: '' },
    ],
    pricing: [
      { description: '', amount: '' },
      { description: '', amount: '' },
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
    setProposalData(prev => ({
      ...prev,
      timeline: prev.timeline.filter((_, i) => i !== index)
    }));
  };

  const removePricingItem = (index: number) => {
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
      alert('Please allow popups for printing to work.');
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

  const getDisplayValue = (value: string | undefined, placeholder: string): string => {
    return value || placeholder;
  };

  const renderTemplate = () => {
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

    switch (selectedTemplate) {
      case 'classic':
        return <ProposalTemplateClassic data={displayData} />;
      case 'modern':
        return <ProposalTemplateModern data={displayData} />;
      case 'minimal':
        return <ProposalTemplateMinimal data={displayData} />;
      default:
        return <ProposalTemplateClassic data={displayData} />;
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

  if (showPreview) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8">
        <div className="max-w-5xl mx-auto px-4">
          {/* Preview Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {isPreviewMode ? 'Proposal Preview' : 'Preview'}
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                {currentProposal ? currentProposal.title : 'Untitled Proposal'} - {templatePreviews[selectedTemplate].name}
              </p>
            </div>
            <div className="flex space-x-3">
              {isPreviewMode && (
                <Button
                  variant="outline"
                  onClick={() => navigate('/proposals')}
                  icon={<ArrowLeft size={18} />}
                  className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Back to Proposals
                </Button>
              )}
              {isPreviewMode && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/proposal-generator?edit=${previewId}`)}
                  icon={<Edit size={18} />}
                  className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Edit
                </Button>
              )}
              {!isPreviewMode && (
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(false)}
                  icon={<ArrowLeft size={18} />}
                  className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Back to Editor
                </Button>
              )}
              <Button
                onClick={handlePrint}
                className="bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 text-white"
              >
                🖨️ Print/PDF
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
          {isEditing && (
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => navigate('/proposals')}
                icon={<ArrowLeft size={18} />}
                size="sm"
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Back to Proposals
              </Button>
            </div>
          )}
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
                        type="text"
                        placeholder="Start Date"
                        value={item.start}
                        onChange={(e) => handleTimelineChange(index, 'start', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                      <input
                        type="text"
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
                <button
                  onClick={addPricingItem}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                >
                  + Add Item
                </button>
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
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
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
    </div>
  );
};

export default ProposalGenerator; 