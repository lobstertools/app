import {
    MoonOutlined,
    SunOutlined,
    QuestionCircleOutlined,
    SettingOutlined,
    BugOutlined,
    SlidersOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, MenuProps, Modal, Tooltip } from 'antd';
import { useAppRuntime } from '../../context/useAppRuntime';
import { InternalDebugView } from '../debug/InternalDebugView';
import { useState } from 'react';

interface ApplicationSettingsMenuProps {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}

/**
 * A dropdown menu for application-level settings like theme
 * and viewing the welcome guide.
 */
export const ApplicationSettingsMenu = ({
    theme,
    toggleTheme,
}: ApplicationSettingsMenuProps) => {
    const { isDevelopmentMode, setWelcomeGuideOpen, setAppSettingsModalOpen } =
        useAppRuntime();
    const [modalApi, contextHolder] = Modal.useModal();

    // Control both dropdown and tooltip open states
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [tooltipOpen, setTooltipOpen] = useState(false);

    /**
     * Shows the internal state debug modal.
     */
    const showDebugModal = () => {
        modalApi.info({
            title: 'Internal Debug State',
            content: <InternalDebugView />,
            width: 800,
            maskClosable: true,
        });
    };

    const menuItems: MenuProps['items'] = [
        {
            key: 'theme-toggle',
            label:
                theme === 'light'
                    ? 'Switch to Dark Mode'
                    : 'Switch to Light Mode',
            icon: theme === 'light' ? <MoonOutlined /> : <SunOutlined />,
            onClick: toggleTheme,
        },
        {
            key: 'app-settings',
            label: 'Application Settings',
            icon: <SlidersOutlined />,
            onClick: () => setAppSettingsModalOpen(true),
        },
        {
            key: 'welcome-guide',
            label: 'View Welcome Guide',
            icon: <QuestionCircleOutlined />,
            onClick: () => setWelcomeGuideOpen(true),
        },
        ...(isDevelopmentMode
            ? [
                  { key: 'divider-debug', type: 'divider' as const },
                  {
                      key: 'debug-view',
                      label: 'State Debug View',
                      icon: <BugOutlined />,
                      onClick: showDebugModal,
                  },
              ]
            : []),
    ];

    // Handler for when the dropdown open state changes
    const handleDropdownOpenChange = (open: boolean) => {
        setDropdownOpen(open);
        // If the dropdown is opening, we MUST hide the tooltip.
        if (open) {
            setTooltipOpen(false);
        }
    };

    // Handler for when the tooltip open state changes (e.g., on hover)
    const handleTooltipOpenChange = (open: boolean) => {
        // Only allow the tooltip to show if the dropdown is NOT open.
        // If dropdown is open, this check will fail and the tooltip will not show.
        if (!dropdownOpen) {
            setTooltipOpen(open);
        }
    };

    return (
        <>
            {contextHolder}
            <Dropdown
                menu={{ items: menuItems }}
                trigger={['click']}
                open={dropdownOpen} // Control the dropdown's open state
                onOpenChange={handleDropdownOpenChange}
            >
                <Tooltip
                    title="Application Settings"
                    open={tooltipOpen} // Control the tooltip's open state
                    onOpenChange={handleTooltipOpenChange} // Use the new handler
                >
                    <Button icon={<SettingOutlined />} shape="circle" />
                </Tooltip>
            </Dropdown>
        </>
    );
};
