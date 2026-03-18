/**
 * paymentConfig/FormActions — 测试/保存按钮 + 测试结果
 * 三个支付表单共享，消除 ~40 行 × 3 的重复代码
 */
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, TestTube2, CheckCircle2, AlertCircle } from "lucide-react";
import type { TestResult } from "./types";

interface FormActionsProps {
  testResult: TestResult | null;
  testPending: boolean;
  savePending: boolean;
  testDisabled?: boolean;
  onTest: () => void;
  onSave: () => void;
}

export function FormActions({ testResult, testPending, savePending, testDisabled, onTest, onSave }: FormActionsProps) {
  return (
    <>
      {testResult && (
        <Alert variant={testResult.success ? "default" : "destructive"}>
          {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>
            {testResult.message}
            {testResult.details && (
              <pre className="mt-2 text-xs opacity-70">{JSON.stringify(testResult.details, null, 2)}</pre>
            )}
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={onTest} disabled={testPending || testDisabled} variant="outline" className="w-full sm:w-auto">
          {testPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />测试中...</>
          ) : (
            <><TestTube2 className="mr-2 h-4 w-4" />测试连接</>
          )}
        </Button>
        <Button onClick={onSave} disabled={savePending} className="w-full sm:w-auto">
          {savePending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />保存中...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" />保存配置</>
          )}
        </Button>
      </div>
    </>
  );
}
