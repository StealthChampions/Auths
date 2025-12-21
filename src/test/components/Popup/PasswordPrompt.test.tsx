import "mocha";
import * as chai from "chai";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordPrompt from '../../../components/popup/PasswordPrompt';

const should = chai.should();
chai.use(sinonChai.default || sinonChai);

describe("PasswordPrompt", () => {
  let onUnlock: sinon.SinonStub;

  beforeEach(() => {
    onUnlock = sinon.stub();
  });

  it("should call onUnlock when button is clicked", async () => {
    onUnlock.resolves(true);
    render(<PasswordPrompt onUnlock={onUnlock} />);

    const passwordInput = screen.getByPlaceholderText("输入密码");
    const submitButton = screen.getByRole("button", { name: "解锁" });

    await userEvent.type(passwordInput, "somePassword");
    await userEvent.click(submitButton);

    await waitFor(() => {
      onUnlock.should.have.been.calledWith("somePassword");
    });
  });

  it("should call onUnlock when enter is pressed", async () => {
    onUnlock.resolves(true);
    render(<PasswordPrompt onUnlock={onUnlock} />);

    const passwordInput = screen.getByPlaceholderText("输入密码");

    await userEvent.type(passwordInput, "anotherPassword{enter}");

    await waitFor(() => {
      onUnlock.should.have.been.calledWith("anotherPassword");
    });
  });

  it("should autofocus password input", () => {
    render(<PasswordPrompt onUnlock={onUnlock} />);
    const passwordInput = screen.getByPlaceholderText("输入密码");
    
    passwordInput.should.eq(document.activeElement);
  });

  it("should not show error message initially", () => {
    render(<PasswordPrompt onUnlock={onUnlock} />);
    
    const errorElement = screen.queryByText(/密码错误|解锁失败|请输入密码/);
    should.not.exist(errorElement);
  });

  it("should show error when password is empty", async () => {
    render(<PasswordPrompt onUnlock={onUnlock} />);
    
    const submitButton = screen.getByRole("button", { name: "解锁" });
    await userEvent.click(submitButton);

    const errorElement = await screen.findByText("请输入密码");
    should.exist(errorElement);
  });

  context("Incorrect password was entered", () => {
    it("should show incorrect password message", async () => {
      onUnlock.resolves(false);
      render(<PasswordPrompt onUnlock={onUnlock} />);

      const passwordInput = screen.getByPlaceholderText("输入密码");
      const submitButton = screen.getByRole("button", { name: "解锁" });

      await userEvent.type(passwordInput, "wrongPassword");
      await userEvent.click(submitButton);

      const errorElement = await screen.findByText("密码错误");
      should.exist(errorElement);
      
      // Check that password input is cleared
      passwordInput.should.have.value("");
    });
  });

  it("should show error message when unlock fails", async () => {
    onUnlock.rejects(new Error("Network error"));
    render(<PasswordPrompt onUnlock={onUnlock} />);

    const passwordInput = screen.getByPlaceholderText("输入密码");
    const submitButton = screen.getByRole("button", { name: "解锁" });

    await userEvent.type(passwordInput, "somePassword");
    await userEvent.click(submitButton);

    const errorElement = await screen.findByText("解锁失败");
    should.exist(errorElement);
  });

  it("should disable button and input during loading", async () => {
    onUnlock.resolves(true);
    render(<PasswordPrompt onUnlock={onUnlock} />);

    const passwordInput = screen.getByPlaceholderText("输入密码");
    const submitButton = screen.getByRole("button", { name: "解锁" });

    await userEvent.type(passwordInput, "somePassword");
    await userEvent.click(submitButton);

    // Check loading state
    await waitFor(() => {
      screen.getByText("解锁中...");
    });

    submitButton.should.be.disabled;
    passwordInput.should.be.disabled;
  });
});