import { Menu, MenuButton, MenuItem } from '@szhsin/react-menu';
import { useNotebookPreferences } from '../store';
import '@szhsin/react-menu/dist/index.css';

interface ChatMenuProps {
  setProactiveEnabled: (enabled: boolean) => void;
}

// COULD ADD OPTION TO HIDE / MINIMIZE THE CHAT HERE TOO, OR MAKE THIS A SEPARATE BUTTON

export const ChatMenu = (props: ChatMenuProps) => {
  const proactiveEnabled = useNotebookPreferences()?.proactiveEnabled;

  return (
    <Menu
      menuButton={
        <MenuButton
          className={`menu-btn ${proactiveEnabled ? 'enabled' : 'disabled'}`}
          aria-label="Options"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 8 16"
            width="8"
            height="16"
            aria-hidden="true"
            style={{ fill: 'var(--jp-ui-font-color0)' }}
          >
            <circle cx="4" cy="3" r="1.5" />
            <circle cx="4" cy="8" r="1.5" />
            <circle cx="4" cy="13" r="1.5" />
          </svg>
        </MenuButton>
      }
      direction="top"
      portal
    >
      <MenuItem onClick={() => props.setProactiveEnabled(!proactiveEnabled)}>
        {proactiveEnabled
          ? 'Turn off Jupytutor for this notebook'
          : 'Turn on Jupytutor for this notebook'}
      </MenuItem>
    </Menu>
  );
};
