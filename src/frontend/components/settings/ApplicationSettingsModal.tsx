import {
    Modal,
    Card,
    Typography,
    Form,
    Select,
    theme as antdTheme,
    Button,
} from 'antd';
import { useAppRuntime } from '../../context/useAppRuntime';
import { useEffect, useMemo } from 'react';

const { Text } = Typography;

// --- List of curated locale codes ---
const supportedLocaleCodes = [
    // 'Browser Default'
    '',

    // North America
    'en-US', // English (United States)
    'en-CA', // English (Canada)
    'fr-CA', // French (Canada)
    'es-MX', // Spanish (Mexico)

    // South America
    'pt-BR', // Portuguese (Brazil)
    'es-AR', // Spanish (Argentina)
    'es-CL', // Spanish (Chile)
    'es-CO', // Spanish (Colombia)

    // Western Europe
    'en-GB', // English (United Kingdom)
    'fr-FR', // French (France)
    'de-DE', // German (Germany)
    'es-ES', // Spanish (Spain)
    'it-IT', // Italian (Italy)
    'pt-PT', // Portuguese (Portugal)
    'nl-NL', // Dutch (Netherlands)
    'de-AT', // German (Austria)
    'fr-BE', // French (Belgium)
    'nl-BE', // Dutch (Belgium)
    'de-CH', // German (Switzerland)
    'fr-CH', // French (Switzerland)
    'it-CH', // Italian (Switzerland)
    'en-IE', // English (Ireland)

    // Northern Europe
    'sv-SE', // Swedish (Sweden)
    'nb-NO', // Norwegian (Norway)
    'da-DK', // Danish (Denmark)
    'fi-FI', // Finnish (Finland)
    'is-IS', // Icelandic (Iceland)

    // Eastern Europe
    'pl-PL', // Polish (Poland)
    'cs-CZ', // Czech (Czechia)
    'hu-HU', // Hungarian (Hungary)
    'ro-RO', // Romanian (Romania)

    // Southern Europe
    'el-GR', // Greek (Greece)
    'tr-TR', // Turkish (Turkey)

    // Oceania
    'en-AU', // English (Australia)
    'en-NZ', // English (New Zealand)
];

/**
 * Helper function to get the human-readable name of a locale.
 * It uses the user's current language to display the name.
 * e.g., 'de-DE' will appear as 'Allemand (Allemagne)' if your
 * browser is set to French.
 */
const getLocaleName = (code: string): string => {
    if (code === '') return 'Default (Browser)';
    try {
        // Use 'undefined' to get the browser's default language
        const displayName = new Intl.DisplayNames(undefined, {
            type: 'language',
            fallback: 'code',
        });

        // Split to handle language-region pairs
        const parts = code.split('-');
        const langName = displayName.of(parts[0]);

        if (parts[1]) {
            // Get region name
            const regionName = new Intl.DisplayNames(undefined, {
                type: 'region',
                fallback: 'code',
            }).of(parts[1]);

            // Format as "Language (Region)"
            if (langName && regionName) {
                // Handle cases like 'fr-CA' (French (Canada))
                return `${langName} (${regionName})`;
            }
        }

        return langName || code; // Fallback to just language name or code
    } catch (e) {
        return code; // Fallback for invalid codes
    }
};

/**
 * A modal for managing application-wide settings.
 */
export const ApplicationSettingsModal = () => {
    const { token } = antdTheme.useToken();
    const {
        isAppSettingsModalOpen,
        setAppSettingsModalOpen,
        locale,
        setLocale,
    } = useAppRuntime();
    const [form] = Form.useForm();

    // Generate the options list.
    // We use useMemo so this list isn't regenerated on every render.
    const localeOptions = useMemo(() => {
        // Generate the full list of options first
        const allOptions = supportedLocaleCodes.map((code) => ({
            value: code,
            label: getLocaleName(code),
        }));

        // Find and separate the "Default (Browser)" option
        const defaultOption = allOptions.find((opt) => opt.value === '');

        // Get all other options and sort them by label
        const otherOptions = allOptions
            .filter((opt) => opt.value !== '')
            .sort((a, b) => a.label.localeCompare(b.label));

        // Return the final list with "Default" at the top
        return defaultOption ? [defaultOption, ...otherOptions] : otherOptions;
    }, []); // Empty dependency array means this runs once

    // Reset the form field when the modal opens or locale changes
    useEffect(() => {
        if (isAppSettingsModalOpen) {
            form.setFieldsValue({ locale: locale });
        }
    }, [isAppSettingsModalOpen, locale, form]);

    const handleClose = () => {
        setAppSettingsModalOpen(false);
    };

    // This is called instantly when the dropdown value changes
    const handleValuesChange = (changedValues: { locale: string }) => {
        if (changedValues.locale !== undefined) {
            setLocale(changedValues.locale);
        }
    };

    return (
        <Modal
            title="Application Settings"
            open={isAppSettingsModalOpen}
            onCancel={handleClose}
            width={640}
            wrapClassName="backdrop-blur-modal"
            footer={[
                <Button key="close" onClick={handleClose}>
                    Close
                </Button>,
            ]}
        >
            <Text type="secondary">
                Manage application-wide preferences. Changes are saved
                automatically.
            </Text>
            <Card
                size="small"
                style={{
                    width: '100%',
                    background: token.colorFillAlter,
                    marginTop: 12,
                }}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onValuesChange={handleValuesChange}
                    initialValues={{ locale: locale }}
                >
                    <Form.Item
                        name="locale"
                        label="Regional Settings"
                        tooltip="Determines the formatting for dates and numbers."
                    >
                        <Select
                            options={localeOptions}
                            showSearch
                            placeholder="Select a regional setting"
                            filterOption={(input, option) =>
                                (option?.label ?? '')
                                    .toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                        />
                    </Form.Item>
                </Form>
            </Card>
        </Modal>
    );
};
