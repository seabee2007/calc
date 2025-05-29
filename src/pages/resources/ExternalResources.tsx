import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { BookOpen, AlignCenterVertical as Certificate, ShieldCheck, ClipboardList } from 'lucide-react';

const ExternalResources: React.FC = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/resources')}
            icon={<ArrowLeft size={20} />}
            className="text-white hover:text-blue-200 mb-4"
          >
            Back to Resources
          </Button>
          <h1 className="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
            External Resources
          </h1>
          <p className="text-white text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mt-2">
            Industry standards, certifications, and educational resources
          </p>
        </div>

        <div className="space-y-8">
          {/* Standards & Regulations */}
          <section>
            <h2 className="text-2xl font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mb-4">
              Standards &amp; Regulations
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-6 bg-white/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <ShieldCheck className="h-6 w-6 text-blue-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">ACI (American Concrete Institute)</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Industry consensus standards for concrete design & construction. Access technical documents, guides, and specifications.
                    </p>
                    <Button
                      as="a"
                      href="https://www.concrete.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      Visit ACI.org
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <ClipboardList className="h-6 w-6 text-green-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">OSHA Safety Guidelines</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Comprehensive safety regulations for concrete work, including PPE requirements and best practices for handling.
                    </p>
                    <Button
                      as="a"
                      href="https://www.osha.gov/concrete-products"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      OSHA Concrete Guidelines
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <BookOpen className="h-6 w-6 text-yellow-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">ASTM Standards</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Testing methods and material specifications for concrete and related materials. Essential for quality control.
                    </p>
                    <Button
                      as="a"
                      href="https://www.astm.org/standards/concrete-and-aggregates-standards.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      ASTM Concrete Standards
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* Education & Certification */}
          <section>
            <h2 className="text-2xl font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mb-4">
              Education &amp; Certification
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-6 bg-white/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <Certificate className="h-6 w-6 text-purple-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">ACI Certification Programs</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Professional certifications for concrete technicians, including field testing, inspection, and specialty applications.
                    </p>
                    <Button
                      as="a"
                      href="https://www.concrete.org/certification/certificationprograms.aspx"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      Browse Certifications
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <Certificate className="h-6 w-6 text-purple-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">NRMCA Certifications</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Industry certifications from the National Ready Mixed Concrete Association, including plant certification and personnel programs.
                    </p>
                    <Button
                      as="a"
                      href="https://www.nrmca.org/certification/"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      NRMCA Programs
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <BookOpen className="h-6 w-6 text-indigo-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Online Learning Resources</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Free educational materials, webinars, and technical publications from industry organizations.
                    </p>
                    <Button
                      as="a"
                      href="https://www.concrete.org/education/freeonlinelearning.aspx"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      Free ACI Resources
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <BookOpen className="h-6 w-6 text-indigo-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Technical Publications</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Access to research papers, technical reports, and industry journals focused on concrete technology.
                    </p>
                    <Button
                      as="a"
                      href="https://www.concrete.org/publications/technicalpapers.aspx"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      Browse Publications
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
};

export default ExternalResources;