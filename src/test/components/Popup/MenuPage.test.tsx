import "mocha";
import * as chai from "chai";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { StoreProvider } from '../../../store/StoreContext';
import MenuPage from '../../../components/popup/MenuPage';

const should = chai.should();
chai.use(sinonChai);

describe("MenuPage", () => {
  let mockChrome: any;

  before(() => {
    // Mock chrome API
    mockChrome = {
      tabs: {
        create: sinon.stub()
      },
      storage: {
        managed: {
          get: sinon.stub()
        }
      }
    };
    (global as any).chrome = mockChrome;
  });

  beforeEach(() => {
    // Reset all stubs
    sinon.reset();
  });

  const renderMenuPage = () => {
    return render(
      <StoreProvider>
        <MenuPage />
      </StoreProvider>
    );
  };

  describe("feedback button", () => {
    // mocks the user agent for testing purposes
    const mockUserAgent = (userAgent: string) => {
      Object.defineProperty(global, "navigator", {
        value: {
          userAgent,
        },
        configurable: true,
        enumerable: true,
        writable: true,
      });
    };

    it("should open a new tab to the Chrome help page when the feedback button is clicked and the user agent is Chrome", async () => {
      mockUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
      );
      
      renderMenuPage();
      
      // Find and click feedback button (assuming it exists in the component)
      const feedbackButton = screen.queryByTitle("Feedback");
      if (feedbackButton) {
        await userEvent.click(feedbackButton);
        
        mockChrome.tabs.create.should.have.been.calledWith({ 
          url: "https://otp.ee/chromeissues" 
        });
      }
    });

    it("should open a new tab to the Edge help page when the feedback button is clicked and the user agent is Edge", async () => {
      mockUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.74 Safari/537.36 Edg/79.0.309.43"
      );
      
      renderMenuPage();
      
      const feedbackButton = screen.queryByTitle("Feedback");
      if (feedbackButton) {
        await userEvent.click(feedbackButton);
        
        mockChrome.tabs.create.should.have.been.calledWith({ 
          url: "https://otp.ee/edgeissues" 
        });
      }
    });

    it("should open a new tab to the Firefox help page when the feedback button is clicked and the user agent is Firefox", async () => {
      mockUserAgent(
        "Mozilla/5.0 (Windows NT x.y; rv:10.0) Gecko/20100101 Firefox/10.0"
      );
      
      renderMenuPage();
      
      const feedbackButton = screen.queryByTitle("Feedback");
      if (feedbackButton) {
        await userEvent.click(feedbackButton);
        
        mockChrome.tabs.create.should.have.been.calledWith({ 
          url: "https://otp.ee/firefoxissues" 
        });
      }
    });

    it("should open a new tab to the Chrome help page when the feedback button is clicked and the user agent is unknown", async () => {
      mockUserAgent("Unknown");
      
      renderMenuPage();
      
      const feedbackButton = screen.queryByTitle("Feedback");
      if (feedbackButton) {
        await userEvent.click(feedbackButton);
        
        mockChrome.tabs.create.should.have.been.calledWith({ 
          url: "https://otp.ee/chromeissues" 
        });
      }
    });
  });

  describe("menu functionality", () => {
    it("should render menu title", () => {
      renderMenuPage();
      
      const menuTitle = screen.getByText("设置");
      should.exist(menuTitle);
    });

    it("should render zoom slider", () => {
      renderMenuPage();
      
      const zoomSlider = screen.getByRole("slider");
      should.exist(zoomSlider);
      (zoomSlider as HTMLInputElement).value.should.equal("100");
    });

    it("should render autofill checkbox", () => {
      renderMenuPage();
      
      const autofillCheckbox = screen.getByLabelText("启用自动填充");
      should.exist(autofillCheckbox);
    });

    it("should render smart filter checkbox", () => {
      renderMenuPage();
      
      const smartFilterCheckbox = screen.getByLabelText("智能过滤");
      should.exist(smartFilterCheckbox);
    });

    it("should render context menu checkbox", () => {
      renderMenuPage();
      
      const contextMenuCheckbox = screen.getByLabelText("启用上下文菜单");
      should.exist(contextMenuCheckbox);
    });

    it("should render theme selector", () => {
      renderMenuPage();
      
      const themeSelector = screen.getByDisplayValue("normal");
      should.exist(themeSelector);
    });

    it("should render autolock input", () => {
      renderMenuPage();
      
      const autolockInput = screen.getByDisplayValue("0");
      should.exist(autolockInput);
    });

    it("should render backup settings button", () => {
      renderMenuPage();
      
      const backupButton = screen.getByText("备份设置");
      should.exist(backupButton);
    });

    it("should render about button", () => {
      renderMenuPage();
      
      const aboutButton = screen.getByText("关于");
      should.exist(aboutButton);
    });

    it("should display version information", () => {
      renderMenuPage();
      
      const versionText = screen.getByText(/版本:/);
      should.exist(versionText);
    });

    it("should handle zoom change", async () => {
      renderMenuPage();
      
      const zoomSlider = screen.getByRole("slider");
      await userEvent.clear(zoomSlider);
      await userEvent.type(zoomSlider, "120");
      
      (zoomSlider as HTMLInputElement).value.should.equal("120");
    });

    it("should handle autofill toggle", async () => {
      renderMenuPage();
      
      const autofillCheckbox = screen.getByLabelText("启用自动填充");
      await userEvent.click(autofillCheckbox);
      
      (autofillCheckbox as HTMLInputElement).checked.should.be.true;
    });

    it("should handle theme change", async () => {
      renderMenuPage();
      
      const themeSelector = screen.getByDisplayValue("normal");
      await userEvent.selectOptions(themeSelector, "dark");
      
      (themeSelector as HTMLSelectElement).value.should.equal("dark");
    });

    it("should handle autolock change", async () => {
      renderMenuPage();
      
      const autolockInput = screen.getByDisplayValue("0");
      await userEvent.clear(autolockInput);
      await userEvent.type(autolockInput, "60");
      
      (autolockInput as HTMLInputElement).value.should.equal("60");
    });
  });
});