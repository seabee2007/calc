import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { Project, CONCRETE_MIX_DESIGNS } from '../types';
import { calculateMixMaterials } from './calculations';
import { calculateConcreteCost, formatPrice } from './pricing';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Type augmentation for jsPDF to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

const formatDateSafely = (dateString: string | undefined | null): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return format(date, 'MMM d, yyyy');
  } catch {
    return 'N/A';
  }
};

// Helper function to save PDF with platform detection
async function savePDFWithPlatformSupport(
  doc: jsPDF, 
  filename: string, 
  title: string = 'PDF Document'
): Promise<boolean> {
  try {
    // Validate that the PDF has content
    const pdfData = doc.output('datauristring');
    if (!pdfData || pdfData.length < 1000) {
      throw new Error('PDF appears to be empty or invalid');
    }
    
    if (Capacitor.isNativePlatform()) {
      // iOS/Android: Use Capacitor plugins for native sharing
      const base64Data = pdfData.split(',')[1];
      
      if (!base64Data) {
        throw new Error('Failed to extract PDF data');
      }
      
      try {
        // Write file to cache directory
        await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache
        });
        
        // Get the file URI for sharing
        const fileUri = await Filesystem.getUri({
          directory: Directory.Cache,
          path: filename
        });
        
        // Share the file using native share sheet
        await Share.share({
          title: title,
          text: 'Please find attached the PDF document.',
          url: fileUri.uri,
          dialogTitle: `Share ${title}`,
          files: [fileUri.uri] // Add files array for better compatibility
        });
        
        console.log('PDF saved and shared successfully on native platform');
        return true;
      } catch (shareError: any) {
        // Handle share cancellation gracefully
        if (shareError.message === 'Share canceled' || shareError.errorMessage === 'Share canceled') {
          console.log('User canceled share dialog');
          return true; // Still consider this a success
        }
        
        // For other share errors, try direct download fallback
        console.warn('Share failed, attempting direct download:', shareError);
        
        try {
          const blob = new Blob([doc.output('blob')], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          console.log('PDF downloaded successfully as fallback');
          return true;
        } catch (fallbackError) {
          console.error('Both share and download failed:', fallbackError);
          throw shareError; // Throw the original share error
        }
      }
    } else {
      // Web: Use standard download unless explicitly sharing
      const isSharing = filename.toLowerCase().includes('share') || title.toLowerCase().includes('share');
      
      if (isSharing) {
        // Create a blob URL for the PDF
        const blob = new Blob([doc.output('blob')], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // Try to use the Web Share API if available
        if ('share' in navigator && 'canShare' in navigator) {
          try {
            const file = new File([blob], filename, { type: 'application/pdf' });
            const shareData = { 
              title: title,
              text: 'Please find attached the PDF document.',
              files: [file]
            };
            
            if (navigator.canShare(shareData)) {
              await navigator.share(shareData);
              URL.revokeObjectURL(url);
              return true;
            }
          } catch (shareError) {
            console.warn('Web Share API failed:', shareError);
            // Fall through to download if sharing fails
          }
        }
        
        // Fallback to download
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Regular download
        doc.save(filename);
      }
      
      console.log('PDF handled successfully on web platform');
      return true;
    }
  } catch (error) {
    console.error('Error saving PDF:', error);
    throw error;
  }
}

// New function to generate Mix Specification PDF
export async function generateMixSpecPDF(
  psi: string,
  airContent: [number, number],
  waterCementRatio: number,
  admixtures: string[],
  filename?: string
): Promise<boolean> {
  console.log('Generating Mix Spec PDF with data:', { psi, airContent, waterCementRatio, admixtures });
  
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Header
    doc.setFontSize(24);
    doc.text('Concrete Mix Specification', pageWidth / 2, 20, { align: 'center' });
    
    // Date
    doc.setFontSize(12);
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy')}`, pageWidth / 2, 30, { align: 'center' });
    
    // Main specifications
    doc.setFontSize(16);
    doc.text('Mix Design Requirements', 14, 50);
    
    doc.setFontSize(12);
    doc.text(`Design Strength: ${psi} PSI`, 14, 65);
    doc.text(`Air Content Range: ${airContent[0]}-${airContent[1]}%`, 14, 75);
    doc.text(`Maximum W/C Ratio: ${waterCementRatio.toFixed(2)}`, 14, 85);
    
    // Admixtures table
    doc.setFontSize(14);
    doc.text('Required Admixtures', 14, 105);
    
    const admixtureData = admixtures.map((admix, index) => [
      (index + 1).toString(),
      admix
    ]);
    
    doc.autoTable({
      startY: 115,
      head: [['#', 'Admixture Requirement']],
      body: admixtureData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 'auto' }
      }
    });
    
    // References
    const currentY = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(14);
    doc.text('Code References', 14, currentY);
    
    const references = [
      'ACI 318-19 Section 5 (Durability Requirements)',
      'ACI 211.2-98 (Standard Practice for Selecting Proportions for Structural Lightweight Concrete)',
      'ACI 308R-16 (Guide to Curing Concrete)',
      'ASTM C494 (Standard Specification for Chemical Admixtures for Concrete)',
      'ASTM C260 (Standard Specification for Air-Entraining Admixtures for Concrete)'
    ];
    
    doc.setFontSize(10);
    references.forEach((ref, index) => {
      doc.text(`• ${ref}`, 14, currentY + 15 + (index * 8));
    });
    
    // Footer
    const finalY = currentY + 15 + (references.length * 8) + 20;
    doc.setFontSize(10);
    doc.text('This specification is generated for reference purposes only.', pageWidth / 2, finalY, { align: 'center' });
    doc.text('Consult with a qualified engineer for final mix design approval.', pageWidth / 2, finalY + 8, { align: 'center' });
    
    // Save the PDF with platform support
    const pdfFilename = filename || `mix-specification-${psi}psi-${Date.now()}.pdf`;
    console.log('Attempting to save PDF with filename:', pdfFilename);
    
    await savePDFWithPlatformSupport(doc, pdfFilename, `Mix Specification - ${psi} PSI`);
    console.log('PDF save method called successfully');
    
    return true;
  } catch (error) {
    console.error('Error generating Mix Spec PDF:', error);
    
    // Fallback: Create a simple text file if PDF generation fails
    try {
      const textContent = `
CONCRETE MIX SPECIFICATION
Generated: ${format(new Date(), 'MMM d, yyyy')}

MIX DESIGN REQUIREMENTS
Design Strength: ${psi} PSI
Air Content Range: ${airContent[0]}-${airContent[1]}%
Maximum W/C Ratio: ${waterCementRatio.toFixed(2)}

REQUIRED ADMIXTURES
${admixtures.map((admix, index) => `${index + 1}. ${admix}`).join('\n')}

CODE REFERENCES
• ACI 318-19 Section 5 (Durability Requirements)
• ACI 211.2-98 (Standard Practice for Selecting Proportions for Structural Lightweight Concrete)
• ACI 308R-16 (Guide to Curing Concrete)
• ASTM C494 (Standard Specification for Chemical Admixtures for Concrete)
• ASTM C260 (Standard Specification for Air-Entraining Admixtures for Concrete)

This specification is generated for reference purposes only.
Consult with a qualified engineer for final mix design approval.
      `;
      
      if (Capacitor.isNativePlatform()) {
        // Try to share as text file on native platforms
        const base64Data = btoa(textContent);
        const fallbackFilename = `mix-specification-${psi}psi-${Date.now()}.txt`;
        
        await Filesystem.writeFile({
          path: fallbackFilename,
          data: base64Data,
          directory: Directory.Cache
        });
        
        const fileUri = await Filesystem.getUri({
          directory: Directory.Cache,
          path: fallbackFilename
        });
        
        await Share.share({
          title: `Mix Specification - ${psi} PSI (Text)`,
          url: fileUri.uri
        });
      } else {
        // Web fallback
      const blob = new Blob([textContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mix-specification-${psi}psi-${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      }
      
      console.log('Generated fallback text file instead of PDF');
      if (Capacitor.isNativePlatform()) {
        // Show native alert on mobile
        alert('PDF generation failed, shared as text file instead.');
      } else {
      alert('PDF generation failed, downloaded as text file instead.');
      }
      return false;
    } catch (fallbackError) {
      console.error('Both PDF and text fallback failed:', fallbackError);
      alert('Download failed. Please try again or contact support.');
      return false;
    }
  }
}

// Updated function to generate proposal PDF with template-specific layouts
export async function generateProposalPDF(
  htmlContent: string, 
  title: string, 
  filename?: string,
  templateType: 'classic' | 'modern' | 'minimal' = 'classic',
  proposalData?: any
): Promise<void> {
  try {
    console.log('Starting PDF generation with template:', templateType);
    console.log('Proposal data:', proposalData);
    
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    let yPosition = margin;
    
    // Helper function to check page break
    const checkPageBreak = (requiredSpace: number = 15) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
    };
    
    // Helper function to add text with wrapping
    const addText = (text: string, fontSize: number = 12, isBold: boolean = false, leftMargin: number = margin, align: 'left' | 'center' | 'right' = 'left') => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      
      const maxWidth = pageWidth - leftMargin - margin;
      const lines = doc.splitTextToSize(text, maxWidth);
      const lineHeight = fontSize * 0.5;
      
      checkPageBreak(lines.length * lineHeight);
      
      lines.forEach((line: string) => {
        if (align === 'center') {
          doc.text(line, pageWidth / 2, yPosition, { align: 'center' });
        } else if (align === 'right') {
          doc.text(line, pageWidth - margin, yPosition, { align: 'right' });
        } else {
          doc.text(line, leftMargin, yPosition);
        }
        yPosition += lineHeight;
      });
      yPosition += 3;
    };
    
    // Parse HTML to extract proposal data if not provided
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
    
    // Extract data from HTML
    const extractedData = proposalData || {
      businessName: tempDiv.querySelector('[class*="business"]')?.textContent?.trim() || title,
      clientName: tempDiv.querySelector('[class*="client"]')?.textContent?.trim() || 'Client',
      projectTitle: tempDiv.querySelector('[class*="project"]')?.textContent?.trim() || 'Project',
      date: format(new Date(), 'MMMM d, yyyy'),
      introduction: '',
      scope: '',
      timeline: [],
      pricing: [],
      terms: '',
      preparedBy: ''
    };
    
    console.log('Extracted data for PDF:', extractedData);
    
    // Extract tables for timeline and pricing
    const tables = tempDiv.querySelectorAll('table');
    const timelineTable: string[][] = [];
    const pricingTable: string[][] = [];
    
    tables.forEach(table => {
      const rows = Array.from(table.querySelectorAll('tr'));
      const tableData: string[][] = [];
      
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td, th'));
        const rowData = cells.map(cell => cell.textContent?.trim() || '');
        if (rowData.some(cell => cell.length > 0)) {
          tableData.push(rowData);
        }
      });
  
      // Determine if it's timeline or pricing based on headers
      const headers = tableData[0] || [];
      const hasTimeline = headers.some(h => h.toLowerCase().includes('phase') || h.toLowerCase().includes('timeline'));
      const hasPricing = headers.some(h => h.toLowerCase().includes('price') || h.toLowerCase().includes('amount') || h.toLowerCase().includes('cost'));
      
      if (hasTimeline && timelineTable.length === 0) {
        timelineTable.push(...tableData);
      } else if (hasPricing && pricingTable.length === 0) {
        pricingTable.push(...tableData);
      }
    });
    
    console.log('Timeline table:', timelineTable);
    console.log('Pricing table:', pricingTable);
    
    // Generate Classic Template Layout
    if (templateType === 'classic') {
      // Header section with business info on left, proposal info on right
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(extractedData.businessName || 'Business Name', margin, yPosition);
      
      // Proposal header on the right
      doc.text('Proposal', pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 12;
      
      // Business details on left, date on right
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      if (extractedData.businessAddress) {
        doc.text(extractedData.businessAddress, margin, yPosition);
      }
      if (extractedData.businessPhone) {
        yPosition += 8;
        doc.text(`Phone: ${extractedData.businessPhone}`, margin, yPosition);
      }
      if (extractedData.businessEmail) {
        yPosition += 8;
        doc.text(`Email: ${extractedData.businessEmail}`, margin, yPosition);
      }
      
      // Date on right side
      doc.text(extractedData.date, pageWidth - margin, yPosition - 16, { align: 'right' });
      
      yPosition += 20;
      
      // Prepared For section
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Prepared For:', margin, yPosition);
      yPosition += 10;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(extractedData.clientName || 'Client Name', margin, yPosition);
      yPosition += 8;
      
      if (extractedData.clientCompany) {
        doc.setFont('helvetica', 'normal');
        doc.text(extractedData.clientCompany, margin, yPosition);
        yPosition += 8;
      }
      
      yPosition += 10;
      
      // Horizontal line
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 15;
      
      // Project Title & Introduction
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(extractedData.projectTitle || 'Project Title', margin, yPosition);
      yPosition += 15;
      
      if (extractedData.introduction) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        addText(extractedData.introduction, 11, false);
        yPosition += 10;
      }
      
      // Scope of Work
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Scope of Work', margin, yPosition);
      yPosition += 10;
      
      if (extractedData.scope) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        addText(extractedData.scope, 11, false);
        yPosition += 10;
      }
      
      // Timeline Table
      if (timelineTable.length > 0) {
        checkPageBreak(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Project Timeline', margin, yPosition);
        yPosition += 10;
        
        doc.autoTable({
          startY: yPosition,
          head: [timelineTable[0]],
          body: timelineTable.slice(1),
          theme: 'grid',
          headStyles: { 
            fillColor: [245, 245, 245],
            textColor: [60, 60, 60],
            fontSize: 11,
            fontStyle: 'bold'
          },
          bodyStyles: {
            fontSize: 10,
            textColor: [60, 60, 60]
          },
          margin: { left: margin, right: margin },
        });
        yPosition = doc.lastAutoTable.finalY + 15;
      }
      
      // Pricing Table
      if (pricingTable.length > 0) {
        checkPageBreak(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Pricing', margin, yPosition);
        yPosition += 10;
        
        doc.autoTable({
          startY: yPosition,
          head: [pricingTable[0]],
          body: pricingTable.slice(1),
          theme: 'grid',
          headStyles: { 
            fillColor: [245, 245, 245],
            textColor: [60, 60, 60],
            fontSize: 11,
            fontStyle: 'bold'
          },
          bodyStyles: {
            fontSize: 10,
            textColor: [60, 60, 60]
          },
          margin: { left: margin, right: margin },
        });
        yPosition = doc.lastAutoTable.finalY + 15;
      }
      
      // Terms & Conditions
      if (extractedData.terms) {
        checkPageBreak(30);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Terms & Conditions', margin, yPosition);
        yPosition += 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        addText(extractedData.terms, 10, false);
        yPosition += 15;
      }
      
      // Footer
      checkPageBreak(25);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Prepared by:', margin, yPosition);
      yPosition += 8;
      doc.setFont('helvetica', 'bold');
      doc.text(extractedData.preparedBy || 'Prepared By Name', margin, yPosition);
      
      if (extractedData.preparedByTitle) {
        yPosition += 8;
        doc.setFont('helvetica', 'normal');
        doc.text(extractedData.preparedByTitle, margin, yPosition);
      }
    }
    
    // Generate Modern Template Layout
    else if (templateType === 'modern') {
      // Modern Banner Header with border
      doc.setLineWidth(2);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPosition + 25, pageWidth - margin, yPosition + 25);
      
      // Business info on left with logo space
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(extractedData.businessName || 'Business Name', margin, yPosition);
      yPosition += 8;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      if (extractedData.businessSlogan) {
        doc.text(extractedData.businessSlogan, margin, yPosition);
    yPosition += 6;
      }
      
      doc.setFont('helvetica', 'normal');
      if (extractedData.businessAddress) {
        doc.text(extractedData.businessAddress, margin, yPosition);
        yPosition += 5;
      }
      
      // Contact info with icons (text-based)
      const contactY = yPosition;
      if (extractedData.businessPhone) {
        doc.text(`📞 ${extractedData.businessPhone}`, margin, contactY);
      }
      if (extractedData.businessEmail) {
        doc.text(`✉️ ${extractedData.businessEmail}`, margin + 70, contactY);
      }
      if (extractedData.businessLicenseNumber) {
        doc.text(`📜 License: ${extractedData.businessLicenseNumber}`, margin + 140, contactY);
      }
      
      // Client info on right side
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Proposal For', pageWidth - margin, yPosition - 20, { align: 'right' });
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(extractedData.clientName || 'Client Name', pageWidth - margin, yPosition - 12, { align: 'right' });
      
      if (extractedData.clientCompany) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(extractedData.clientCompany, pageWidth - margin, yPosition - 4, { align: 'right' });
      }
      
      yPosition += 35;
      
      // Project Title with accent color
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(79, 70, 229); // Indigo color
      doc.text(extractedData.projectTitle || 'Project Title', margin, yPosition);
      
      doc.setTextColor(0, 0, 0); // Reset to black
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(extractedData.date, margin, yPosition + 8);
      yPosition += 25;
      
      // Two-column layout for Introduction and Scope
      const columnWidth = (pageWidth - margin * 3) / 2;
      const leftColumnX = margin;
      const rightColumnX = margin + columnWidth + margin;
      
      // Introduction column
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Introduction', leftColumnX, yPosition);
      
      if (extractedData.introduction) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const introLines = doc.splitTextToSize(extractedData.introduction, columnWidth);
        let introY = yPosition + 10;
        introLines.forEach((line: string) => {
          doc.text(line, leftColumnX, introY);
          introY += 5;
        });
      }
      
      // Scope column
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Scope of Work', rightColumnX, yPosition);
      
      if (extractedData.scope) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const scopeLines = doc.splitTextToSize(extractedData.scope, columnWidth);
        let scopeY = yPosition + 10;
        scopeLines.forEach((line: string) => {
          doc.text(line, rightColumnX, scopeY);
          scopeY += 5;
        });
      }
      
      yPosition += 60; // Move past the two-column section
      
      // Timeline and Pricing Cards (side by side)
      checkPageBreak(60);
      
      // Card backgrounds (light gray rectangles)
      doc.setFillColor(249, 250, 251);
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      
      // Timeline Card
      doc.rect(leftColumnX, yPosition, columnWidth, 50, 'FD');
      doc.setFillColor(255, 255, 255); // Reset fill color
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(75, 85, 99);
      doc.text('Timeline', leftColumnX + 8, yPosition + 12);
      
      // Timeline items
      if (timelineTable.length > 1) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        let timelineY = yPosition + 20;
        
        for (let i = 1; i < Math.min(timelineTable.length, 4); i++) {
          const row = timelineTable[i];
          if (row.length >= 3) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(107, 114, 128);
            doc.text(`${row[0]}:`, leftColumnX + 8, timelineY);
            
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(31, 41, 55);
            doc.text(`${row[1]} – ${row[2]}`, leftColumnX + 8 + 40, timelineY);
            timelineY += 8;
          }
        }
      }
      
      // Pricing Card
      doc.setFillColor(249, 250, 251);
      doc.rect(rightColumnX, yPosition, columnWidth, 50, 'FD');
      doc.setFillColor(255, 255, 255);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(75, 85, 99);
      doc.text('Pricing', rightColumnX + 8, yPosition + 12);
      
      // Pricing items
      if (pricingTable.length > 1) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        let pricingY = yPosition + 20;
        
        for (let i = 1; i < Math.min(pricingTable.length, 4); i++) {
          const row = pricingTable[i];
          if (row.length >= 2) {
            doc.setTextColor(107, 114, 128);
            const descLines = doc.splitTextToSize(row[0], columnWidth - 50);
            doc.text(descLines[0], rightColumnX + 8, pricingY);
            
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(31, 41, 55);
            doc.text(row[1], rightColumnX + columnWidth - 8, pricingY, { align: 'right' });
            
            doc.setFont('helvetica', 'normal');
            pricingY += 8;
          }
        }
      }
      
      doc.setTextColor(0, 0, 0); // Reset color
      yPosition += 65;
      
      // Terms & Conditions
      if (extractedData.terms) {
        checkPageBreak(30);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Terms & Conditions', margin, yPosition);
        yPosition += 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        addText(extractedData.terms, 10, false);
        yPosition += 15;
      }
      
      // Dashed line separator
      doc.setLineWidth(0.5);
      doc.setDrawColor(209, 213, 219);
      // Create dashed line effect with short segments
      const dashLength = 3;
      const gapLength = 3;
      let currentX = margin;
      while (currentX < pageWidth - margin) {
        const endX = Math.min(currentX + dashLength, pageWidth - margin);
        doc.line(currentX, yPosition, endX, yPosition);
        currentX += dashLength + gapLength;
      }
      yPosition += 15;
      
      // Footer - centered
      checkPageBreak(20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text('Prepared by:', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text(extractedData.preparedBy || 'Prepared By Name', pageWidth / 2, yPosition, { align: 'center' });
      
      if (extractedData.preparedByTitle) {
        yPosition += 8;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text(extractedData.preparedByTitle, pageWidth / 2, yPosition, { align: 'center' });
      }
    }
    
    // Generate Minimal Template Layout
    else if (templateType === 'minimal') {
      // Simple header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(extractedData.businessName || 'Business Name', margin, yPosition);
      yPosition += 8;
      
      // Business slogan
      if (extractedData.businessSlogan) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(107, 114, 128);
        doc.text(extractedData.businessSlogan, margin, yPosition);
        yPosition += 6;
      }
      
      // Business address
      if (extractedData.businessAddress) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text(extractedData.businessAddress, margin, yPosition);
        yPosition += 5;
      }
      
      // Contact info in one line
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      const contactInfo = [];
      if (extractedData.businessPhone) contactInfo.push(extractedData.businessPhone);
      if (extractedData.businessEmail) contactInfo.push(extractedData.businessEmail);
      if (extractedData.businessLicenseNumber) contactInfo.push(`License: ${extractedData.businessLicenseNumber}`);
      
      if (contactInfo.length > 0) {
        doc.text(contactInfo.join('   •   '), margin, yPosition);
        yPosition += 15;
      } else {
        yPosition += 10;
      }
      
      // Client & Project section
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Proposal For', margin, yPosition);
      yPosition += 10;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(extractedData.clientName || 'Client Name', margin, yPosition);
      yPosition += 8;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(extractedData.projectTitle || 'Project Title', margin, yPosition);
      yPosition += 6;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(extractedData.date, margin, yPosition);
      yPosition += 15;
      
      // Horizontal line
      doc.setLineWidth(0.5);
      doc.setDrawColor(209, 213, 219);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 15;
      
      // Introduction
      if (extractedData.introduction) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Introduction', margin, yPosition);
        yPosition += 8;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        addText(extractedData.introduction, 10, false);
        yPosition += 5;
      }
      
      // Scope of Work
      if (extractedData.scope) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Scope of Work', margin, yPosition);
        yPosition += 8;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        addText(extractedData.scope, 10, false);
        yPosition += 5;
      }
      
      // Timeline Inline
      if (timelineTable.length > 1) {
        checkPageBreak(25);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Timeline', margin, yPosition);
        yPosition += 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        for (let i = 1; i < timelineTable.length; i++) {
          const row = timelineTable[i];
          if (row.length >= 3 && row[0].trim()) {
            checkPageBreak(12);
            
            // Phase name on left
            doc.setTextColor(0, 0, 0);
            doc.text(row[0], margin, yPosition);
            
            // Date range on right
            doc.setFont('helvetica', 'bold');
            const dateRange = `${row[1]} – ${row[2]}`;
            doc.text(dateRange, pageWidth - margin, yPosition, { align: 'right' });
            
            doc.setFont('helvetica', 'normal');
            yPosition += 10;
          }
        }
        yPosition += 5;
      }
      
      // Pricing Inline
      if (pricingTable.length > 1) {
        checkPageBreak(25);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Pricing', margin, yPosition);
        yPosition += 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        for (let i = 1; i < pricingTable.length; i++) {
          const row = pricingTable[i];
          if (row.length >= 2 && row[0].trim()) {
            checkPageBreak(12);
            
            // Description on left
            doc.setTextColor(0, 0, 0);
            const descLines = doc.splitTextToSize(row[0], pageWidth - margin - 60);
            doc.text(descLines[0], margin, yPosition);
            
            // Amount on right
            doc.setFont('helvetica', 'bold');
            doc.text(row[1], pageWidth - margin, yPosition, { align: 'right' });
            
            doc.setFont('helvetica', 'normal');
            yPosition += 10;
          }
        }
        yPosition += 5;
      }
      
      // Terms & Conditions
      if (extractedData.terms) {
        checkPageBreak(25);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Terms & Conditions', margin, yPosition);
        yPosition += 8;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        addText(extractedData.terms, 9, false);
        yPosition += 10;
      }
      
      // Footer with border
      checkPageBreak(20);
      doc.setLineWidth(0.5);
      doc.setDrawColor(229, 231, 235);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 12;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text('Prepared by:', margin, yPosition);
      yPosition += 8;
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(extractedData.preparedBy || 'Prepared By Name', margin, yPosition);
    }
    
    // Fallback for unrecognized template types
    else {
      console.warn(`Unknown template type: ${templateType}, using classic layout`);
      
      // Use classic template as fallback
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(extractedData.businessName || 'Business Name', margin, yPosition);
      
      doc.text('Proposal', pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 20;
      
      doc.setFontSize(14);
      doc.text('Prepared For:', margin, yPosition);
      yPosition += 10;
      
      doc.setFontSize(12);
      doc.text(extractedData.clientName || 'Client Name', margin, yPosition);
      yPosition += 15;
      
      doc.setFontSize(16);
      doc.text(extractedData.projectTitle || 'Project Title', margin, yPosition);
      yPosition += 15;
      
      if (extractedData.introduction) {
        addText(extractedData.introduction, 11, false);
      }
      
      if (extractedData.scope) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Scope of Work', margin, yPosition);
        yPosition += 10;
        addText(extractedData.scope, 11, false);
      }
    }
    
    // Ensure the PDF has content before saving
    if (yPosition <= margin + 20) {
      // PDF appears to be empty, add some basic content
      console.warn('PDF appears empty, adding fallback content');
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Concrete Proposal', pageWidth / 2, 40, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, pageWidth / 2, 60, { align: 'center' });
      
      doc.text('This proposal was generated electronically.', margin, 100);
      doc.text('Please contact us for detailed information.', margin, 120);
    }
  
  // Save the PDF
    const pdfFilename = filename || `proposal-${templateType}-${Date.now()}.pdf`;
    await savePDFWithPlatformSupport(doc, pdfFilename, title);
  } catch (error) {
    console.error('Error generating proposal PDF:', error);
    throw error;
  }
}

export async function generateProjectPDF(
  project: Project, 
  selectedPsi: keyof typeof CONCRETE_MIX_DESIGNS
): Promise<void> {
  try {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Header
  doc.setFontSize(24);
  doc.text('Project Report', pageWidth / 2, 20, { align: 'center' });
  
  // Project Details
  doc.setFontSize(14);
  doc.text('Project Details', 14, 40);
  doc.setFontSize(12);
  doc.text(`Name: ${project.name || 'Untitled Project'}`, 14, 50);
  doc.text(`Created: ${formatDateSafely(project.createdAt)}`, 14, 60);
  if (project.description) {
    doc.text('Description:', 14, 70);
    const splitDescription = doc.splitTextToSize(project.description, pageWidth - 28);
    doc.text(splitDescription, 14, 80);
  }
  
  // Calculate total volume
  const calculations = project.calculations || [];
  const totalVolume = calculations.reduce((total, calc) => total + (calc.result?.volume || 0), 0);
  
  // Mix Design
  const mixDesign = calculateMixMaterials(totalVolume || 1, selectedPsi);
  doc.setFontSize(14);
  doc.text('Concrete Mix Design', 14, 110);
  doc.setFontSize(12);
  
  const mixDesignData = [
    ['Component', 'Amount', 'Unit'],
    ['Portland Cement', mixDesign.materials.cement.toFixed(2), 'yd³'],
    ['Fine Aggregate (Sand)', mixDesign.materials.sand.toFixed(2), 'yd³'],
    ['Coarse Aggregate', mixDesign.materials.aggregate.toFixed(2), 'yd³'],
    ['Water', mixDesign.materials.water.toString(), 'gal'],
  ];
  
    doc.autoTable({
    startY: 120,
    head: [mixDesignData[0]],
    body: mixDesignData.slice(1),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
  });
  
  // Additional Mix Design Details
    const currentY = doc.lastAutoTable.finalY + 10;
  doc.text(`Strength: ${selectedPsi} PSI`, 14, currentY);
  doc.text(`Water/Cement Ratio: ${mixDesign.waterCementRatio}`, 14, currentY + 10);
  doc.text(`Slump Range: ${mixDesign.slump.min}" - ${mixDesign.slump.max}"`, 14, currentY + 20);
  
  // Cost Estimate
  const costEstimate = calculateConcreteCost(totalVolume || 1, selectedPsi);
  doc.setFontSize(14);
  doc.text('Cost Estimate', 14, currentY + 40);
  
  const costData = [
    ['Item', 'Cost'],
    ['Concrete Cost', formatPrice(costEstimate.concreteCost)],
    ['Delivery Fees', formatPrice(costEstimate.deliveryFees.totalDeliveryFees)],
    ['Total Estimated Cost', formatPrice(costEstimate.totalCost)]
  ];
  
    doc.autoTable({
    startY: currentY + 50,
    head: [costData[0]],
    body: costData.slice(1),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
  });

  // QC Records - only if they exist in the project
  const projectWithQC = project as any;
  if (projectWithQC.qcRecords && projectWithQC.qcRecords.length > 0) {
      const qcY = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(14);
    doc.text('Quality Control Records', 14, qcY);

    const qcData = projectWithQC.qcRecords.map((record: any) => [
      format(new Date(record.date), 'MM/dd/yyyy'),
      `${record.temperature}°F`,
      `${record.humidity}%`,
      `${record.slump}"`,
      `${record.air_content}%`,
      record.cylindersMade.toString(),
      record.notes || ''
    ]);

      doc.autoTable({
      startY: qcY + 10,
      head: [['Date', 'Temp', 'Humidity', 'Slump', 'Air', 'Cylinders', 'Notes']],
      body: qcData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
        6: { cellWidth: 'auto' }
      }
    });
  }
  
  // Calculations Table
  if (calculations.length > 0) {
      const calculationsY = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(14);
    doc.text('Calculations', 14, calculationsY);
    
    const calculationsData = calculations.map(calc => [
      calc.type.charAt(0).toUpperCase() + calc.type.slice(1),
      formatDateSafely(calc.createdAt),
      `${calc.result?.volume || 0} yd³`,
      calc.result?.bags?.toString() || '0'
    ]);
    
      doc.autoTable({
      startY: calculationsY + 10,
      head: [['Type', 'Date', 'Volume', 'Bags Required']],
      body: calculationsData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });
  }
  
  // Footer
  const pageCount = (doc.internal as any).getNumberOfPages();
  doc.setFontSize(10);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }
  
    // Save the PDF with platform support
  const fileName = project.name ? 
    `${project.name.toLowerCase().replace(/\s+/g, '-')}-report.pdf` : 
    'concrete-mix-report.pdf';
    
    await savePDFWithPlatformSupport(doc, fileName, `Project Report - ${project.name || 'Untitled'}`);
  } catch (error) {
    console.error('Error generating project PDF:', error);
    throw error;
  }
}

export async function generateReinforcementPDF(
  result: any,
  options: {
    projectName: string;
    calculatorData: any;
    coverIn: number;
    mode: string;
    isColumn: boolean;
    spacingXIn?: number;
    spacingYIn?: number;
    verticalBars?: number;
  },
  title: string,
  filename?: string
): Promise<void> {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    let yPosition = margin;

    // Helper function to check page break
    const checkPageBreak = (requiredSpace: number = 15) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
    };

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Reinforcement Design Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;

    // Project Information
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Project Information', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Project: ${options.projectName}`, margin, yPosition);
    yPosition += 8;
    doc.text(`Reinforcement Type: ${options.mode.charAt(0).toUpperCase() + options.mode.slice(1)}`, margin, yPosition);
    yPosition += 8;
    doc.text(`Structure Type: ${options.isColumn ? 'Column' : 'Slab'}`, margin, yPosition);
    yPosition += 15;

    // Dimensions
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Dimensions', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Length: ${options.calculatorData.length_ft}'`, margin, yPosition);
    yPosition += 8;
    doc.text(`Width: ${options.calculatorData.width_ft}'`, margin, yPosition);
    yPosition += 8;
    doc.text(`Thickness: ${options.calculatorData.thickness_in}"`, margin, yPosition);
    yPosition += 8;
    if (options.calculatorData.height_ft) {
      doc.text(`Height: ${options.calculatorData.height_ft}'`, margin, yPosition);
      yPosition += 8;
    }
    doc.text(`Cover: ${options.coverIn}"`, margin, yPosition);
    yPosition += 15;

    // Design Results
    checkPageBreak(30);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Design Results', margin, yPosition);
    yPosition += 10;

    if (options.mode === 'rebar') {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      
      if (result.pick) {
        doc.text(`Recommended Bar Size: ${result.pick.size}`, margin, yPosition);
        yPosition += 8;
        
        if (options.isColumn) {
          doc.text(`Vertical Bars: ${result.pick.verticalBars || options.verticalBars}`, margin, yPosition);
          yPosition += 8;
        } else {
          doc.text(`X-Direction Spacing: ${result.pick.spacingXIn || options.spacingXIn}"`, margin, yPosition);
          yPosition += 8;
          doc.text(`Y-Direction Spacing: ${result.pick.spacingYIn || options.spacingYIn}"`, margin, yPosition);
          yPosition += 8;
        }
      }
      
      if (result.totalBars) {
        doc.text(`Total Bars: ${result.totalBars}`, margin, yPosition);
        yPosition += 8;
      }
      
      if (result.totalLinearFt) {
        doc.text(`Total Linear Feet: ${result.totalLinearFt.toFixed(1)} ft`, margin, yPosition);
        yPosition += 15;
      }

      // Cut List Table
      if (result.listX || result.listY || result.verticalBars) {
        checkPageBreak(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Cut List', margin, yPosition);
        yPosition += 10;

        const tableData: string[][] = [];
        
        if (options.isColumn) {
          // Column rebar tables
          if (result.verticalBars) {
            tableData.push(['Type', 'Length', 'Quantity']);
            result.verticalBars.forEach((item: any) => {
              tableData.push(['Vertical Bar', `${item.lengthFt.toFixed(1)}'`, item.qty.toString()]);
            });
          }
          if (result.tieList) {
            result.tieList.forEach((item: any) => {
              tableData.push(['Tie Bar', `${item.lengthFt.toFixed(1)}'`, item.qty.toString()]);
            });
          }
        } else {
          // Slab rebar tables
          tableData.push(['Direction', 'Length', 'Quantity']);
          
          if (result.listX) {
            result.listX.forEach((item: any) => {
              tableData.push(['X-Direction', `${item.lengthFt.toFixed(1)}'`, item.qty.toString()]);
            });
          }
          
          if (result.listY) {
            result.listY.forEach((item: any) => {
              tableData.push(['Y-Direction', `${item.lengthFt.toFixed(1)}'`, item.qty.toString()]);
            });
          }
        }

        if (tableData.length > 1) {
          doc.autoTable({
            startY: yPosition,
            head: [tableData[0]],
            body: tableData.slice(1),
            theme: 'grid',
            headStyles: { 
              fillColor: [59, 130, 246],
              textColor: [255, 255, 255],
              fontSize: 12,
              fontStyle: 'bold'
            },
            bodyStyles: {
              fontSize: 11,
              textColor: [60, 60, 60]
            },
            margin: { left: margin, right: margin },
          });
          yPosition = doc.lastAutoTable.finalY + 15;
        }
      }
    }

    // Notes and References
    checkPageBreak(40);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const notes = [
      '• This design is for reference purposes only',
      '• Consult a structural engineer for final approval',
      '• All dimensions and spacing should be verified on-site',
      '• Follow local building codes and ACI standards',
      '• Ensure proper concrete cover for environmental conditions'
    ];

    notes.forEach(note => {
      doc.text(note, margin, yPosition);
      yPosition += 6;
    });

    // Footer
    yPosition += 10;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('Generated by Concrete Calculator App', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Save the PDF
    const pdfFilename = filename || `reinforcement-design-${Date.now()}.pdf`;
    await savePDFWithPlatformSupport(doc, pdfFilename, title);
  } catch (error) {
    console.error('Error generating reinforcement PDF:', error);
    throw error;
  }
}